'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cx } from '@/lib/utils';

export type ConfirmTone = 'danger' | 'default';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const t = useTranslations('common');
  const counter = useRef(0);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      counter.current += 1;
      setPending({ ...opts, id: counter.current, resolve });
    });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [pending]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!pending) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pending]);

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  const onCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      // Triggered by Esc; prevent default close so we control resolution.
      e.preventDefault();
      settle(false);
    },
    [settle],
  );

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) settle(false);
    },
    [settle],
  );

  const value = useMemo(() => confirm, [confirm]);
  const tone: ConfirmTone = pending?.tone ?? 'default';
  const isDanger = tone === 'danger';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={pending?.description ? descId : undefined}
        onCancel={onCancel}
        onClick={onBackdropClick}
        className={cx(
          'pinboard-confirm m-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]',
          'p-0 shadow-[var(--shadow-md)]',
          'w-[min(28rem,calc(100vw-2rem))]',
          'open:animate-[pinboard-confirm-in_120ms_ease-out]',
        )}
      >
        {pending && (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cx(
                  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  isDanger ? 'bg-[color:var(--danger-soft)]' : 'bg-[color:var(--accent-soft)]',
                )}
              >
                {isDanger ? (
                  <Trash2 size={18} className="text-[color:var(--danger)]" />
                ) : (
                  <AlertTriangle size={18} className="text-[color:var(--accent)]" />
                )}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id={titleId}
                  className="text-base font-semibold tracking-tight text-[color:var(--text)]"
                >
                  {pending.title}
                </h2>
                {pending.description && (
                  <p
                    id={descId}
                    className="mt-1 text-sm text-[color:var(--text-muted)]"
                  >
                    {pending.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => settle(false)}
                aria-label={t('cancel')}
                className="-mt-1 -me-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-faint)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => settle(false)}
              >
                {pending.cancelLabel ?? t('cancel')}
              </Button>
              <Button
                type="button"
                variant={isDanger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel ?? t('confirm')}
              </Button>
            </div>
          </div>
        )}
      </dialog>

      {/* Native <dialog> backdrop styling + entrance animation */}
      <style>{`
        dialog.pinboard-confirm::backdrop {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(2px);
        }
        @keyframes pinboard-confirm-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
