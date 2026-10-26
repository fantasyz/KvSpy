import { formatAge, formatBytes } from '../../utils/format';
import type { ContextCacheEntry } from '../Model/types';
import DetailCell from './DetailCell';
import styles from './CellDetailHeader.module.css';

interface CellDetailHeaderProps {
  entry: ContextCacheEntry;
}

// Multi-row key information for the selected entry.
function CellDetailHeader({ entry }: CellDetailHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.rows}>
        <DetailCell label="ID" value={entry.id} />
        {entry.sessionKey && <DetailCell label="Session" value={entry.sessionKey} />}
        <DetailCell label="Tokens" value={entry.promptTokens.toLocaleString()} />
        <DetailCell label="Residency" value={entry.residency || '—'} />
        <DetailCell
          label="Retention"
          value={entry.retention || '—'}
          explicit={entry.retentionExplicit}
        />
        <DetailCell label="Age" value={formatAge(entry.lastHitAgeMs)} />
        <DetailCell label="Active refs" value={String(entry.activeReferences)} />
        <DetailCell label="Shared" value={entry.shared ? 'yes' : 'no'} />
        {entry.deviceKvPages != null && (
          <DetailCell
            label="Device pages (excl.)"
            value={String(entry.deviceKvPages)}
          />
        )}
        {entry.deviceKvPagesTotal != null && (
          <DetailCell
            label="Device pages (total)"
            value={String(entry.deviceKvPagesTotal)}
          />
        )}
        {entry.hostKvBytes != null && (
          <DetailCell label="Host bytes" value={formatBytes(entry.hostKvBytes)} />
        )}
      </div>
    </div>
  );
}

export default CellDetailHeader;
