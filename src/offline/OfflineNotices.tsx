// Keeps ConduitOT working without a network: registers the service worker (src/offline/sw.js) and
// tells the user when the app is ready offline, when the network is gone, and when a new version is
// ready to start. Loaded on demand from App, in production builds only.
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '../store/announcer';
import { saveForReload, useAutosaveStatus } from '../store/autosave';

type Notice = 'ready' | 'offline' | 'update' | 'updated-elsewhere';

const TEXT: Record<Notice, string> = {
  ready: 'ConduitOT now works offline: after this, it opens and runs in this browser without a network connection.',
  offline: 'You are offline. ConduitOT keeps working without a network connection.',
  update: 'A new version of ConduitOT is ready. Reload to start it.',
  'updated-elsewhere': 'ConduitOT was updated in another tab. Reload this tab to use the new version.',
};

/** How often an open app looks for a new version, besides each time it is opened. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

export function OfflineNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);
  const unsaved = useAutosaveStatus((s) => s.failed);

  const show = useCallback((notice: Notice) => {
    setNotices((list) => (list.includes(notice) ? list : [...list, notice]));
    announce(TEXT[notice]);
  }, []);
  const hide = useCallback((notice: Notice) => setNotices((list) => list.filter((n) => n !== notice)), []);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    // A page opened without a service worker is taken over by the first one once it has the app
    // stored; that change of controller is not an update.
    let controlled = !!sw.controller;
    let registration: ServiceWorkerRegistration | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tracked = new WeakSet<ServiceWorker>();

    /** Follows a worker being installed; `first` when no version was active before it. */
    const track = (worker: ServiceWorker, first: boolean) => {
      if (tracked.has(worker)) return;
      tracked.add(worker);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && !first) {
          setWaiting(worker);
          show('update');
        } else if (worker.state === 'activated' && first) {
          show('ready');
        }
      });
    };
    const check = () => void registration?.update().catch(() => undefined);

    const onControllerChange = () => {
      if (reloading.current) {
        location.reload();
      } else if (controlled) {
        // Another tab started the new version; this one still runs the old code.
        hide('update');
        show('updated-elsewhere');
      }
      controlled = true;
    };
    const onOffline = () => {
      if (sw.controller) show('offline');
    };
    const onOnline = () => {
      hide('offline');
      check();
    };

    const start = () => {
      sw.register('./sw.js')
        .then((reg) => {
          registration = reg;
          if (reg.waiting && sw.controller) {
            setWaiting(reg.waiting);
            show('update');
          }
          if (reg.installing) track(reg.installing, !reg.active);
          reg.addEventListener('updatefound', () => reg.installing && track(reg.installing, !reg.active));
          timer = setInterval(check, CHECK_EVERY_MS);
        })
        .catch((error: unknown) => console.warn('ConduitOT could not set up offline use:', error));
    };

    sw.addEventListener('controllerchange', onControllerChange);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (!navigator.onLine) onOffline();
    // Storing the app for offline use waits until the page has loaded, so it does not slow startup.
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      clearInterval(timer);
      sw.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('load', start);
    };
  }, [show, hide]);

  const reload = () => {
    saveForReload();
    reloading.current = true;
    // The new version starts once the old one lets go; the page reloads when it has.
    if (waiting?.state === 'installed') waiting.postMessage('skip-waiting');
    else location.reload();
  };

  const kept = unsaved ? 'This browser is not keeping your work, so save the project file first.' : 'Your work is kept.';

  // New notices are read out through the app's live region (announce), so this is not one itself.
  return (
    <div className="toasts">
      {notices.map((notice) => {
        const offersReload = notice === 'update' || notice === 'updated-elsewhere';
        return (
          <div key={notice} className="notice notice--info toast">
            <p>{offersReload ? `${TEXT[notice]} ${kept}` : TEXT[notice]}</p>
            {offersReload ? (
              <>
                <button type="button" className="button" onClick={reload}>
                  Reload
                </button>
                <button type="button" className="button" onClick={() => hide(notice)}>
                  Later
                </button>
              </>
            ) : (
              <button type="button" className="icon-button" onClick={() => hide(notice)} title="Dismiss">
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
