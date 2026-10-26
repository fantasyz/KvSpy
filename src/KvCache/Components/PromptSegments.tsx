import { Badge } from '@mantine/core';
import { Const } from '../Model/Const';
import type { PromptSegment } from '../Model/types';
import useOverlaysStore from '../Store/useOverlaysStore';
import usePromptContentStore from '../Store/usePromptContentStore';
import useSettingsStore from '../Store/useSettingsStore';
import styles from './PromptSegments.module.css';

// A segment plus its original position in the entry's full segment list, so
// the displayed numbering follows the chosen sort direction.
export interface IndexedPromptSegment {
  segment: PromptSegment;
  index: number;
}

interface PromptSegmentsProps {
  segments: IndexedPromptSegment[];
}

// Cached prompt rendered as a flat list of non-foldable rows. Each row shows
// the index, a color-coded role label, a clipped content preview and a char
// count badge. Clicking a row opens the full content in a popup.
function PromptSegments({ segments }: PromptSegmentsProps) {
  const open = useOverlaysStore((s) => s.open);
  const stripMarkers = useSettingsStore((s) => s.settings.detailStripMarkers);

  const onRowClick = (segment: PromptSegment, index: number) => {
    const label = `${index}. ${roleLabel(segment.role)}`;
    usePromptContentStore.getState().setContent(segment.text, label);
    open('promptContent');
  };

  return (
    <div className={styles.list}>
      {segments.map(({ segment, index }) => (
        <div key={index} className={styles.row} onClick={() => onRowClick(segment, index)}>
          <span className={styles.index}>{index}.</span>
          <Badge
            variant="filled"
            className={styles.role}
            style={roleBadgeStyle(segment.role)}
          >
            {roleLabel(segment.role)}
          </Badge>
          <span className={styles.preview}>{clipPreview(segment.text, stripMarkers)}</span>
          <Badge variant="light" size="xs" className={styles.badge}>
            {segment.text.length.toLocaleString()}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// Capitalize the raw role string for display (e.g. "system" -> "System").
function roleLabel(role: string): string {
  if (!role) {
    return 'Message';
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Role -> badge colors. Bright fills with a contrasting text color; light
// fills (system yellow) use black text, dark fills use white.
function roleBadgeStyle(role: string): { backgroundColor: string; color: string } {
  switch (role.toLowerCase()) {
    case 'system':
      return { backgroundColor: '#FFD400', color: '#000' };
    case 'user':
      return { backgroundColor: '#2979FF', color: '#fff' };
    case 'assistant':
      return { backgroundColor: '#C62828', color: '#fff' };
    default:
      // Tool / unknown roles: gray fill, white text.
      return { backgroundColor: '#6C757D', color: '#fff' };
  }
}

// Matches any model message marker (e.g. <|im_start|>), including the role
// word after markers flagged with stripRole.
const MSG_MARKER_RE = new RegExp(
  Const.app.detailMsgMarkers
    .map(({ text, stripRole }) => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return stripRole ? `${escaped}\\s*[A-Za-z_]+` : escaped;
    })
    .join('|'),
  'g',
);

// Collapse newlines and trim so the preview fits on a single line; optionally
// strip model message markers first.
function clipPreview(text: string, stripMarkers: boolean): string {
  const base = stripMarkers ? text.replace(MSG_MARKER_RE, '') : text;
  return base.replace(/\s+/g, ' ').trim();
}

export default PromptSegments;
