'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Modal built on the native <dialog> (focus trap + Esc for free). */
export function Dialog({ open, onClose, title, description, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useTranslations('common');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        'pinboard-confirm m-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-0 text-[color:var(--text)] shadow-[var(--shadow-md)]',
        'w-[min(32rem,calc(100vw-2rem))]',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('cancel')}
              className="-mt-1 -me-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-faint)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]"
            >
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
