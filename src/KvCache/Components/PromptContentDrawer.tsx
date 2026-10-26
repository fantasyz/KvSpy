import { useState } from 'react';
import { ActionIcon, Drawer, Group, SegmentedControl, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy } from '@tabler/icons-react';
import { copyTextToClipboard } from '../../utils/clipboard';
import useOverlaysStore from '../Store/useOverlaysStore';
import usePromptContentStore from '../Store/usePromptContentStore';
import useSettingsStore from '../Store/useSettingsStore';
import XmlCode from './XmlCode';
import styles from './PromptContentDrawer.module.css';

type ContentView = 'xml' | 'raw';

// Full content of a selected prompt segment, shown in a left drawer that
// matches the cache view's left column width (from useSettingsStore) so it
// just covers that column. The drawer stays open while the user changes
// selection — only the content (from usePromptContentStore) updates. The
// header offers a Raw|XML toggle so special inference tags that XML
// highlighting may mangle can be viewed as plain text, and a copy button to
// grab the content.
function PromptContentDrawer() {
  const opened = useOverlaysStore((s) => s.openStack.includes('promptContent'));
  const close = useOverlaysStore((s) => s.close);
  const text = usePromptContentStore((s) => s.text);
  const label = usePromptContentStore((s) => s.label);
  const leftColumnWidth = useSettingsStore((s) => s.settings.leftColumnWidth);
  const [view, setView] = useState<ContentView>('raw');

  const onCopy = async () => {
    const ok = await copyTextToClipboard(text);
    notifications.show({
      message: ok ? 'Copied to clipboard' : 'Copy failed',
      color: ok ? 'green' : 'red',
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={() => close('promptContent')}
      position="left"
      // No backdrop overlay, and no close-on-outside-click: the drawer must stay
      // open while the user clicks other prompt rows (in the right-hand detail
      // column) to swap the displayed content. It closes via the X button/Escape.
      withOverlay={false}
      closeOnClickOutside={false}
      vars={() => ({ root: { '--drawer-size': `${leftColumnWidth}px` } })}
      title={
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={700}>{label}</Text>
          <Group>
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(value) => setView(value as ContentView)}
              data={[
                { value: 'xml', label: 'XML' },
                { value: 'raw', label: 'Raw' },
              ]}
            />
            <ActionIcon
              onClick={onCopy}
              variant="subtle"
              title="Copy content to clipboard"
              aria-label="Copy content to clipboard"
            >
              <IconCopy size={16} />
            </ActionIcon>
          </Group>
        </Group>
      }
      styles={{
        // No backdrop to separate the drawer from the page, so give the panel
        // its own edge line on the right (the side facing the rest of the UI).
        content: { borderRight: '1px solid var(--mantine-color-dark-4)' },
        header: { borderBottom: '1px solid var(--mantine-color-gray-7)' },
        body: { backgroundColor: 'var(--mantine-color-dark-9)' },
      }}
    >
      {view === 'xml' ? <XmlCode text={text} /> : <pre className={styles.raw}>{text}</pre>}
    </Drawer>
  );
}

export default PromptContentDrawer;
