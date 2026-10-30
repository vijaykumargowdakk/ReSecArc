// The browser's offer to install ReSecArc as an app, kept so the command palette can accept it.
// Chromium-based browsers send it once the app qualifies; the others install from their own menus.
// main.tsx imports this module so the offer is caught even if it comes before anything else loads.
import { create } from 'zustand';

interface InstallOffer extends Event {
  prompt: () => Promise<void>;
}

export const useInstall = create<{ offer: InstallOffer | null }>(() => ({ offer: null }));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => useInstall.setState({ offer: event as InstallOffer }));
  window.addEventListener('appinstalled', () => useInstall.setState({ offer: null }));
}

/** Shows the browser's install dialog. An offer can be used once; the browser makes a new one if it is declined. */
export function installApp(): void {
  const { offer } = useInstall.getState();
  if (!offer) return;
  useInstall.setState({ offer: null });
  void offer.prompt();
}
