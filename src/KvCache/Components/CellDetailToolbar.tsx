import { Button, Chip, Group } from '@mantine/core';
import { IconLabel, IconLabelOff, IconSortAZ, IconSortZA } from '@tabler/icons-react';
import { Services } from '../../services';
import useSettingsStore from '../Store/useSettingsStore';
import { Const } from '../Model/Const';
import styles from './CellDetailToolbar.module.css';

// Toolbar in the detail column, below the attribute header. Left: filter
// pills controlling which message roles are shown in the prompt segment
// list. Right: a strip-markers toggle and the segment list sort direction.
// All persist in app settings.
function CellDetailToolbar() {
  const visibleRoles = useSettingsStore((s) => s.settings.detailVisibleRoles);
  const sortDesc = useSettingsStore((s) => s.settings.detailSortDesc);
  const stripMarkers = useSettingsStore((s) => s.settings.detailStripMarkers);

  const toggleRole = (role: string) => {
    const next = visibleRoles.includes(role)
      ? visibleRoles.filter((r) => r !== role)
      : [...visibleRoles, role];
    Services.settings.setDetailVisibleRoles(next);
  };

  return (
    <div className={styles.toolbar}>
      <Group gap="xs">
        {Const.app.detailRoleFilters.map((role) => (
          <Chip
            key={role}
            size="xs"
            variant={visibleRoles.includes(role) ? 'filled' : 'subtle'}
            checked={visibleRoles.includes(role)}
            onChange={(checked) => {
              if (checked !== visibleRoles.includes(role)) toggleRole(role);
            }}
          >
            {role}
          </Chip>
        ))}
      </Group>
      <Group gap="xs">
        <Button
          variant="subtle"
          size="xs"
          title={
            stripMarkers
              ? 'Strip message markers from previews (click to show them)'
              : 'Show message markers in previews (click to strip them)'
          }
          onClick={() => Services.settings.setDetailStripMarkers(!stripMarkers)}
        >
          {stripMarkers ? <IconLabelOff size={16} /> : <IconLabel size={16} />}
        </Button>
        <Button
          variant="subtle"
          size="xs"
          title={
            sortDesc
              ? 'Sort: descending (click for ascending)'
              : 'Sort: ascending (click for descending)'
          }
          onClick={() => Services.settings.setDetailSortDesc(!sortDesc)}
        >
          {sortDesc ? <IconSortZA size={16} /> : <IconSortAZ size={16} />}
        </Button>
      </Group>
    </div>
  );
}

export default CellDetailToolbar;
