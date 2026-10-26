import { Tabs } from '@mantine/core';
import { useState } from 'react';
import CacheList from './CacheList';
import TriggersPanel from './TriggersPanel';
import styles from './LeftColumnTabs.module.css';

// Left column of the cache view: a tabbed page (Cache | Triggers). The
// active tab is session state only (not persisted).
function LeftColumnTabs() {
  const [activeTab, setActiveTab] = useState('cache');

  return (
    <Tabs
      value={activeTab}
      onChange={(value) => setActiveTab(value ?? 'cache')}
      variant="line"
      className={styles.tabs}
    >
      <Tabs.List className={styles.list}>
        <Tabs.Tab value="cache">Cache</Tabs.Tab>
        <Tabs.Tab value="triggers">Triggers</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="cache" className={styles.panel}>
        <CacheList />
      </Tabs.Panel>
      <Tabs.Panel value="triggers" className={styles.panel}>
        <TriggersPanel />
      </Tabs.Panel>
    </Tabs>
  );
}

export default LeftColumnTabs;
