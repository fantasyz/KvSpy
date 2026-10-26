import useOverlaysStore from '../Store/useOverlaysStore';
import AppSettingsModal from './AppSettingsModal';
import ConfirmOverlay from './ConfirmOverlay';
import PromptContentDrawer from './PromptContentDrawer';

// The app-level overlay host: renders the opened overlays in stack order so
// they sit above the normal UI. Each overlay component checks its own key to
// decide visibility.
function Overlays() {
  const stack = useOverlaysStore((s) => s.openStack);
  return (
    <>
      {stack.map((key) => {
        if (key === 'appSettings') return <AppSettingsModal key={key} />;
        if (key === 'promptContent') return <PromptContentDrawer key={key} />;
        if (key === 'confirm') return <ConfirmOverlay key={key} />;
        return null;
      })}
    </>
  );
}

export default Overlays;
