'use client';

import { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePwa } from '@/components/pwa-provider';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function PwaInstall() {
  const t = useTranslations('pwa');
  const { installed, canPrompt, install } = usePwa();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  if (installed) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
      >
        <Smartphone size={16} aria-hidden className="shrink-0" />
        {t('install')}
      </button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t('install')}
        description={t('intro')}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <div className="space-y-4">
          {canPrompt && (
            <Button
              className="w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const accepted = await install();
                setPending(false);
                if (accepted) setOpen(false);
              }}
            >
              <Download size={17} aria-hidden />
              {t('installNow')}
            </Button>
          )}
          <section className="rounded-xl bg-[color:var(--surface-muted)] p-4">
            <h3 className="font-semibold">{t('iphone')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{t('iphoneSteps')}</p>
          </section>
          <section className="rounded-xl bg-[color:var(--surface-muted)] p-4">
            <h3 className="font-semibold">{t('android')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{t('androidSteps')}</p>
          </section>
          <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">{t('onlineHint')}</p>
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
