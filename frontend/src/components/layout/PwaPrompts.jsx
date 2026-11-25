import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';
import { Button } from '../common';

/** Install prompt (shown only when the browser offers installation) + "new version" notification. */
export default function PwaPrompts() {
  const [installEvt, setInstallEvt] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('aran_install_dismissed') === '1');
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  useEffect(() => {
    const on = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', () => setInstallEvt(null));
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const install = async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); };
  const dismiss = () => { localStorage.setItem('aran_install_dismissed', '1'); setDismissed(true); };

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[80] flex flex-col items-center gap-2 lg:bottom-5 lg:left-auto lg:right-5 lg:items-end">
      <AnimatePresence>
        {!online && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto rounded-xl bg-bad px-4 py-3 text-sm text-white shadow-lift" role="status">
            You're offline. Recently viewed menu items are available; ordering needs a connection.
          </motion.div>
        )}
        {needRefresh && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lift" role="status">
            <RefreshCw className="size-4" /> A new version of ARAN.co is available.
            <Button size="sm" onClick={() => updateServiceWorker(true)}>Update</Button>
          </motion.div>
        )}
        {installEvt && !dismissed && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-auto flex items-center gap-3 rounded-xl border border-sand bg-white px-4 py-3 text-sm shadow-lift">
            <Download className="size-4 text-brand" /> Install ARAN.co for faster ordering.
            <Button size="sm" onClick={install}>Install</Button>
            <button onClick={dismiss} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full hover:bg-sand/60"><X className="size-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
