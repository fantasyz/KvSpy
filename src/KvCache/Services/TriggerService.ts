import bus from '../../utils/eventBus';
import { AppEvents } from '../../utils/eventKeys';
import { Log } from '../../Common/Log';
import { Const } from '../Model/Const';
import useSettingsStore from '../Store/useSettingsStore';
import useConnectionStore from '../Store/useConnectionStore';
import usePendingReleaseStore from '../Store/usePendingReleaseStore';
import { EngineService } from './EngineService';
import { CacheRelationshipService } from './CacheRelationshipService';
import type { ContextCacheEntry, TriggerAction, TriggerDef } from '../Model/types';

// How a pending task finds its target entry at fire time.
type TaskTargetKind = 'same' | 'byId' | 'bySessionKey';

// A scheduled (not yet fired) trigger action.
interface PendingTriggerTask {
  triggerId: string;
  entryId: string;
  marker: string;
  action: TriggerAction;
  fireAt: number;
  timerId: number;
  targetKind: TaskTargetKind;
  // The captured {ID} / {SessionKey} value (byId / bySessionKey tasks).
  targetParam?: string;
  // Prompt-content signature at arm time; a re-detection with an identical
  // signature is a duplicate poll, not new activity, so it does not re-arm.
  contentSignature: string;
}

// Watches for context markers in arriving cache entries and performs the
// configured action (set-disposable / release) after a delay. Case 2
// semantics: detection only *queues* a task; at fire time the target entry is
// re-resolved against the current entry list so the action lands on the
// newest entry (a session extension replaces the id, not the content).
//
// Marker types: `endCurrentSession` targets the entry containing the marker;
// `startSessionById` registers `{ID} → entryId` (no action); `endSessionById`
// targets the registered entry; `endSessionBySessionKey` targets the entry
// whose `session_key` field equals the captured key.
export abstract class TriggerService {
  private static tasks = new Map<string, PendingTriggerTask>();
  // Captured session ID → entry id of the entry carrying the BEGIN marker.
  private static sessionRegistry = new Map<string, string>();
  private static initialized = false;
  private static textModeHintShown = false;

  static init(): void {
    if (TriggerService.initialized) {
      return;
    }
    TriggerService.initialized = true;

    bus.on(AppEvents.cacheUpdated, (payload: { entries: ContextCacheEntry[] }) =>
      TriggerService.onCacheUpdated(payload.entries)
    );
    bus.on(AppEvents.connectionChanged, (payload: { connected: boolean }) => {
      if (!payload.connected) {
        TriggerService.clearTasks('disconnected');
      }
    });
    bus.on(AppEvents.triggersChanged, () => TriggerService.pruneTasks());
  }

  // Drop pending tasks whose trigger no longer exists, is disabled, or has
  // no action (the user edited the trigger list).
  private static pruneTasks(): void {
    const { triggers } = useSettingsStore.getState().settings;
    let removed = 0;
    for (const [taskKey, task] of TriggerService.tasks) {
      const trigger = triggers.find((t) => t.id === task.triggerId);
      if (!trigger || !trigger.enabled || trigger.action === 'none') {
        window.clearTimeout(task.timerId);
        TriggerService.tasks.delete(taskKey);
        if (task.action === 'release') {
          usePendingReleaseStore.getState().remove(task.entryId);
        }
        removed++;
      }
    }
    if (removed > 0) {
      Log.write(`Trigger: ${removed} pending task(s) pruned (trigger change).`);
    }
  }

  // Detection: scan the changed entries for markers; same-entry triggers queue
  // a delayed task, the BEGIN trigger registers the session, the END triggers
  // resolve their cross-entry target and queue a task for it.
  private static onCacheUpdated(entries: ContextCacheEntry[]): void {
    const { triggers } = useSettingsStore.getState().settings;
    const active = triggers.filter(
      (t) => t.enabled && (t.action !== 'none' || t.type === 'startSessionById')
    );
    if (active.length === 0) {
      return;
    }
    if (useSettingsStore.getState().settings.textMode !== 'full') {
      if (!TriggerService.textModeHintShown) {
        TriggerService.textModeHintShown = true;
        Log.write('Trigger detection skipped: switch to Full text mode for entries to carry content.');
      }
      return;
    }

    const { lastResult } = useConnectionStore.getState();
    for (const entry of entries) {
      // Shared prefixes are always shared_stable and reject retention changes.
      if (entry.shared || !entry.promptSegments) {
        continue;
      }
      for (const trigger of active) {
        TriggerService.detectTriggerOnEntry(trigger, entry, lastResult?.entries ?? []);
      }
    }
  }

  // One trigger against one entry: capture the token (if any) and act on the
  // matching semantics of the trigger type.
  private static detectTriggerOnEntry(
    trigger: TriggerDef,
    entry: ContextCacheEntry,
    allEntries: ContextCacheEntry[]
  ): void {
    const contentSignature = TriggerService.contentSignatureOf(entry);
    switch (trigger.type) {
      case 'endCurrentSession':
        if (TriggerService.matchesMarker(entry, trigger.marker)) {
          TriggerService.scheduleTask(trigger, entry.id, 'same', undefined, contentSignature);
        }
        break;
      case 'startSessionById': {
        const id = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenId
        );
        if (id === null) {
          return;
        }
        const isNewSession = !TriggerService.sessionRegistry.has(id);
        TriggerService.sessionRegistry.set(id, entry.id);
        if (isNewSession) {
          Log.write(`Trigger: session "${id}" registered (BEGIN) → ${entry.id}.`);
        }
        break;
      }
      case 'endSessionById': {
        const id = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenId
        );
        if (id === null) {
          return;
        }
        const targetId = TriggerService.sessionRegistry.get(id);
        if (!targetId) {
          Log.write(`Trigger: END "${id}" ignored (no BEGIN registered).`);
          return;
        }
        TriggerService.scheduleTask(trigger, targetId, 'byId', id, contentSignature);
        break;
      }
      case 'endSessionBySessionKey': {
        const key = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenSessionKey
        );
        if (key === null) {
          return;
        }
        const target = allEntries.find((e) => !e.shared && e.sessionKey === key);
        if (!target) {
          Log.write(`Trigger: session-key "${key}" ignored (no entry with that session_key).`);
          return;
        }
        TriggerService.scheduleTask(trigger, target.id, 'bySessionKey', key, contentSignature);
        break;
      }
    }
  }

  // Queue (or re-arm) the delayed task for a marker hit.
  private static scheduleTask(
    trigger: TriggerDef,
    entryId: string,
    targetKind: TaskTargetKind,
    targetParam: string | undefined,
    contentSignature: string
  ): void {
    const key = `${trigger.id}|${entryId}`;
    const existing = TriggerService.tasks.get(key);
    if (existing) {
      // A re-detection of an unchanged entry is a duplicate poll (auto-refresh
      // re-scans every entry), not new activity: let the pending timer run.
      if (existing.contentSignature === contentSignature) {
        return;
      }
      // Content actually changed: latest detection wins, refresh the fire time.
      window.clearTimeout(existing.timerId);
      existing.marker = trigger.marker;
      existing.action = trigger.action;
      existing.fireAt = Date.now() + trigger.delaySec * 1000;
      existing.timerId = window.setTimeout(() => {
        void TriggerService.fireTask(key);
      }, existing.fireAt - Date.now());
      existing.contentSignature = contentSignature;
      Log.write(
        `Trigger: marker "${trigger.marker}" re-matched; action re-armed on ${entryId} (${trigger.delaySec}s).`
      );
      return;
    }

    // A new release supersedes a pending set-disposable on the same entry
    // (releasing makes the disposable mark moot).
    if (trigger.action === 'release') {
      for (const [taskKey, task] of TriggerService.tasks) {
        if (task.entryId === entryId && task.action === 'disposable') {
          window.clearTimeout(task.timerId);
          TriggerService.tasks.delete(taskKey);
          Log.write(`Trigger: pending set-disposable on ${entryId} dropped (release queued).`);
        }
      }
    }

    const fireAt = Date.now() + trigger.delaySec * 1000;
    const timerId = window.setTimeout(() => {
      void TriggerService.fireTask(key);
    }, trigger.delaySec * 1000);
    TriggerService.tasks.set(key, {
      triggerId: trigger.id,
      entryId,
      marker: trigger.marker,
      action: trigger.action,
      fireAt,
      timerId,
      targetKind,
      targetParam,
      contentSignature,
    });
    Log.write(
      `Trigger: marker "${trigger.marker}" matched; ${trigger.action} on ${entryId} in ${trigger.delaySec}s.`
    );

    // Flag the cell for the skull marker during the delay window (release
    // tasks only: a disposable mark does not delete the entry).
    if (trigger.action === 'release') {
      usePendingReleaseStore.getState().add(entryId);
    }
  }

  // Firing: re-resolve the target on the current entry list, then act.
  private static async fireTask(key: string): Promise<void> {
    const task = TriggerService.tasks.get(key);
    if (!task) {
      return;
    }
    TriggerService.tasks.delete(key);
    if (task.action === 'release') {
      usePendingReleaseStore.getState().remove(task.entryId);
    }

    const { lastResult, status } = useConnectionStore.getState();
    if (status !== 'connected' || !lastResult) {
      Log.write(`Trigger: ${task.action} skipped (disconnected).`);
      return;
    }

    const entry = TriggerService.resolveTarget(task, lastResult.entries);
    if (!entry) {
      Log.write(`Trigger: ${task.action} no-op (target entry gone).`);
      return;
    }

    if (useSettingsStore.getState().settings.triggerDryRun) {
      const verb = task.action === 'release' ? 'DELETE' : 'PATCH retention=disposable';
      Log.write(`[dry-run] Trigger: would ${verb} ${entry.id} (${TriggerService.targetDetail(task)}).`);
      return;
    }

    Log.write(`Trigger: firing ${task.action} on ${entry.id}.`);
    let ok = false;
    if (task.action === 'release') {
      ok = await TriggerService.releaseWithRetry(entry.id);
    } else if (task.action === 'disposable') {
      ok = await EngineService.setRetention(entry.id, 'disposable');
      if (!ok) {
        Log.write(`Trigger: set-disposable on ${entry.id} failed.`, true);
      }
    }
    // The session is recycled: drop its registration.
    if (ok && task.targetKind === 'byId' && task.targetParam) {
      TriggerService.sessionRegistry.delete(task.targetParam);
    }
  }

  // Re-resolve a task's target against the current entry list (Case 2 back
  // half). Returns null when the action should be a no-op.
  private static resolveTarget(
    task: PendingTriggerTask,
    entries: ContextCacheEntry[]
  ): ContextCacheEntry | null {
    switch (task.targetKind) {
      case 'same': {
        const entry = entries.find((e) => e.id === task.entryId);
        if (!entry) {
          return null;
        }
        if (!TriggerService.matchesMarker(entry, task.marker)) {
          return null;
        }
        return entry;
      }
      case 'byId': {
        const registered = task.targetParam
          ? TriggerService.sessionRegistry.get(task.targetParam)
          : undefined;
        let entry = entries.find((e) => e.id === (registered ?? task.entryId));
        if (!entry && task.targetParam) {
          // The id was replaced (session extended): re-scan for the BEGIN
          // marker carrying the same ID to find the successor entry.
          const begin = useSettingsStore
            .getState()
            .settings.triggers.find((t) => t.type === 'startSessionById');
          if (begin) {
            for (const candidate of entries) {
              if (
                !candidate.shared &&
                TriggerService.matchTemplate(
                  candidate,
                  begin.marker,
                  Const.app.triggerTokenId
                ) === task.targetParam
              ) {
                entry = candidate;
                TriggerService.sessionRegistry.set(task.targetParam, candidate.id);
                break;
              }
            }
          }
        }
        return entry ?? null;
      }
      case 'bySessionKey':
        return entries.find((e) => !e.shared && e.sessionKey === task.targetParam) ?? null;
    }
  }

  // Human-readable target description for logs / dry-run lines.
  private static targetDetail(task: PendingTriggerTask): string {
    switch (task.targetKind) {
      case 'same':
        return `marker "${task.marker}"`;
      case 'byId':
        return `END "${task.targetParam}", registered target`;
      case 'bySessionKey':
        return `session-key "${task.targetParam}"`;
    }
  }

  // Release with bounded retries: the engine answers 409 while an in-flight
  // request reads the entry, so a delayed release may need to wait it out.
  private static async releaseWithRetry(entryId: string): Promise<boolean> {
    const delays = Const.app.triggerReleaseRetryDelaysMs;
    for (let attempt = 0; ; attempt++) {
      const status = await EngineService.releaseEntryRaw(entryId);
      if (status >= 200 && status < 300) {
        Log.write(`Trigger: entry ${entryId} released.`);
        return true;
      }
      if (status === 404) {
        Log.write(`Trigger: release ${entryId} no-op (entry gone, 404).`);
        return false;
      }
      if (status === 409 && attempt < delays.length) {
        Log.write(
          `Trigger: release ${entryId} busy (409); retry ${attempt + 1} in ${delays[attempt] / 1000}s.`
        );
        await sleep(delays[attempt]);
        continue;
      }
      Log.write(`Trigger: release ${entryId} failed (HTTP ${status}).`, true);
      return false;
    }
  }

  // Dry-run: evaluate all triggers against one entry and log the outcome per
  // marker (the Test button). No engine requests are issued. Disabled
  // triggers are included so the user sees what each would do.
  static detect(entryId: string): void {
    const { lastResult } = useConnectionStore.getState();
    const entry = lastResult?.entries.find((e) => e.id === entryId);
    if (!entry) {
      Log.write(`Test: entry ${entryId} not in the current cache.`, true);
      return;
    }
    const { triggers } = useSettingsStore.getState().settings;
    if (triggers.length === 0) {
      Log.write('Test: no triggers defined.');
      return;
    }
    Log.write(`Test: checking ${triggers.length} marker(s) against ${entryId}.`);
    for (const trigger of triggers) {
      TriggerService.testTriggerOnEntry(trigger, entry, lastResult?.entries ?? []);
    }
  }

  // One trigger tested against one entry (Test button); logs the outcome.
  private static testTriggerOnEntry(
    trigger: TriggerDef,
    entry: ContextCacheEntry,
    allEntries: ContextCacheEntry[]
  ): void {
    const actionLabel =
      trigger.action === 'none' ? 'no action' : `${trigger.action} in ${trigger.delaySec}s`;
    const notDetected = () => Log.write(`Test: marker "${trigger.marker}" NOT detected.`);
    switch (trigger.type) {
      case 'endCurrentSession':
        if (TriggerService.matchesMarker(entry, trigger.marker)) {
          Log.write(`Test: marker "${trigger.marker}" detected on ${entry.id} → ${actionLabel}.`);
        } else {
          notDetected();
        }
        break;
      case 'startSessionById': {
        const id = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenId
        );
        if (id === null) {
          notDetected();
        } else {
          Log.write(
            `Test: marker "${trigger.marker}" detected on ${entry.id} → would register session "${id}" → ${entry.id}.`
          );
        }
        break;
      }
      case 'endSessionById': {
        const id = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenId
        );
        if (id === null) {
          notDetected();
          break;
        }
        const target = TriggerService.sessionRegistry.get(id);
        if (target) {
          Log.write(
            `Test: marker "${trigger.marker}" detected on ${entry.id} → END "${id}" → target ${target} (registered) → ${actionLabel}.`
          );
        } else {
          Log.write(
            `Test: marker "${trigger.marker}" detected on ${entry.id} → END "${id}" not registered (no BEGIN seen).`
          );
        }
        break;
      }
      case 'endSessionBySessionKey': {
        const key = TriggerService.matchTemplate(
          entry,
          trigger.marker,
          Const.app.triggerTokenSessionKey
        );
        if (key === null) {
          notDetected();
          break;
        }
        const target = allEntries.find((e) => !e.shared && e.sessionKey === key);
        if (target) {
          Log.write(
            `Test: marker "${trigger.marker}" detected on ${entry.id} → session-key "${key}" → target ${target.id} → ${actionLabel}.`
          );
        } else {
          Log.write(
            `Test: marker "${trigger.marker}" detected on ${entry.id} → no entry with session_key "${key}".`
          );
        }
        break;
      }
    }
  }

  // Match a marker template (`prefix {Token} suffix`) against the entry's
  // prompt text; returns the captured token value, or null when the pattern
  // does not occur. The capture must be a valid token value
  // (Const.app.triggerTokenValuePattern) — an empty capture (some harnesses
  // leave the session key blank) or one with other characters is invalid and
  // does not match. A pattern without the token falls back to a plain
  // substring check (capture = '').
  static matchTemplate(entry: ContextCacheEntry, marker: string, token: string): string | null {
    if (!entry.promptSegments) {
      return null;
    }
    const tokenIndex = marker.indexOf(token);
    if (tokenIndex < 0) {
      return TriggerService.matchesMarker(entry, marker) ? '' : null;
    }
    const prefix = marker.slice(0, tokenIndex);
    const suffix = marker.slice(tokenIndex + token.length);
    for (const segment of entry.promptSegments) {
      const text = segment.text;
      let from = 0;
      for (;;) {
        const start = text.indexOf(prefix, from);
        if (start < 0) {
          break;
        }
        const captureStart = start + prefix.length;
        const captureEnd = text.indexOf(suffix, captureStart);
        if (captureEnd > captureStart) {
          const capture = text.slice(captureStart, captureEnd);
          if (Const.app.triggerTokenValuePattern.test(capture)) {
            return capture;
          }
        }
        from = start + 1;
      }
    }
    return null;
  }

  // Plain case-sensitive substring match across the entry's prompt text.
  static matchesMarker(entry: ContextCacheEntry, marker: string): boolean {
    if (!marker || !entry.promptSegments) {
      return false;
    }
    return entry.promptSegments.some((segment) => segment.text.includes(marker));
  }

  // A stable signature of the entry's prompt content, used to distinguish a
  // genuine re-detection (content changed) from a duplicate poll of an
  // unchanged entry, so the latter does not keep re-arming the task.
  private static contentSignatureOf(entry: ContextCacheEntry): string {
    return CacheRelationshipService.promptTextOf(entry) ?? '';
  }

  // Drop all pending tasks and session registrations (disconnect, trigger edits).
  private static clearTasks(reason: string): void {
    if (TriggerService.tasks.size > 0) {
      const count = TriggerService.tasks.size;
      for (const task of TriggerService.tasks.values()) {
        window.clearTimeout(task.timerId);
      }
      TriggerService.tasks.clear();
      Log.write(`Trigger: ${count} pending task(s) cleared (${reason}).`);
    }
    usePendingReleaseStore.getState().clear();
    if (TriggerService.sessionRegistry.size > 0) {
      Log.write(`Trigger: ${TriggerService.sessionRegistry.size} session registration(s) cleared (${reason}).`);
    }
    TriggerService.sessionRegistry.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
