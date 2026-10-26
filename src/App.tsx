import { useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import { theme } from './theme';
import { Notifications } from '@mantine/notifications';
import { Log } from './Common/Log';
import { quitApp } from './platform';
import MenuBar from './KvCache/Components/MenuBar';
import CacheView from './KvCache/Components/CacheView';
import ConsolePanel from './KvCache/Components/ConsolePanel';
import Overlays from './KvCache/Components/Overlays';
import styles from './App.module.css';

// Root component: Mantine dark theme + a flex column (fixed header / scrolling
// cache view / collapsible console footer), plus the app-level overlay host and
// the Mantine notifications host.
function App() {
  // App-level shortcut: Ctrl+W closes the app (same as the App > Exit menu),
  // but never while the user is typing in a text field.
  useEffect(() => {
    // True when the focused element is a text entry control, so Ctrl+W stays
    // available to the field instead of quitting the app mid-typing.
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) {
        return false;
      }
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const isCtrlW =
        event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'w';
      if (!isCtrlW || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      Log.write('Shortcut Ctrl+W pressed → exiting app.');
      void quitApp();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <div className={styles.app}>
        <header className={styles.header}>
          <MenuBar />
        </header>
        <main className={styles.main}>
          <CacheView />
        </main>
        <ConsolePanel />
      </div>
      <Overlays />
      <Notifications position="bottom-center" />
    </MantineProvider>
  );
}

export default App;
