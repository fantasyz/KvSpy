import { Text } from '@mantine/core';
import styles from './DetailCell.module.css';

interface DetailCellProps {
  label: string;
  value: string;
  explicit?: boolean;
}

// A single label → value cell. When `explicit` is set, shows a small badge
// next to the value indicating the user set it explicitly (not auto-managed).
function DetailCell({ label, value, explicit }: DetailCellProps) {
  return (
    <div className={styles.cell}>
      <Text size="xs" c="dimmed" className={styles.label}>
        {label}
      </Text>
      <div className={styles.valueRow}>
        <Text size="sm" className={styles.value}>
          {value}
        </Text>
        {explicit && (
          <span
            className={styles.explicitBadge}
            title="Set explicitly via the admin API (not auto-managed by the engine)"
          >
            user-set
          </span>
        )}
      </div>
    </div>
  );
}

export default DetailCell;
