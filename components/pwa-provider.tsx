'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const PwaContext = createContext({ installed: false, canPrompt: false, install: async () => false });
function subscribeConnection(change: () => void) {
  window.addEventListener('online', change);
  window.addEventListener('offline', change);
  return () => {
    window.removeEventListener('online', change);
    window.removeEventListener('offline', change);
  };
}
function subscribeDisplay(change: () => void) {
  const query = window.matchMedia('(display-mode: standalone)');
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('pwa');
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeDisplay, isStandalone, () => false);
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    function beforeInstall(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    }
    function didInstall() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => console.warn('Pinboard offline screen could not be registered.'));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
    };
  }, []);
  async function install() {
    if (!prompt) return false;
    setPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        return true;
      }
    } catch {
      /* The browser menu remains available if the prompt expires. */
    }
    return false;
  }
  return (
    <PwaContext.Provider value={{ installed: installed || standalone, canPrompt: Boolean(prompt), install }}>
      {children}
      {!online && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-sm"
        >
          <WifiOff size={18} aria-hidden className="shrink-0" />
          {t('offline')}
        </div>
      )}
    </PwaContext.Provider>
  );
}
export function usePwa() {
  return useContext(PwaContext);
}
