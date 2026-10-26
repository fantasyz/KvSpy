import useOverlaysStore from './useOverlaysStore';
import useConfirmStore, { type DontAskAgainOption } from './useConfirmStore';

// Opens the confirmation dialog and resolves with the user's choice.
export abstract class ConfirmOverlayLauncher {
  static openAsync(
    message: string,
    opts?: { dontAskAgain?: DontAskAgainOption },
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Init the store first so the dialog renders with its message.
      useConfirmStore.getState().open(message, resolve, opts?.dontAskAgain ?? null);
      useOverlaysStore.getState().open('confirm');
    });
  }
}

export default ConfirmOverlayLauncher;
