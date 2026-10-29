'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  description?: string;
  /** Auto-dismiss after N ms. Pass 0 to make sticky. Defaults to 4000 (errors: 6000). */
  duration?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
  tone: ToastTone;
  title: string;
}

export interface ToastApi {
  show: (tone: ToastTone, title: string, opts?: ToastOptions) => number;
  success: (title: string, opts?: ToastOptions) => number;
  error: (title: string, opts?: ToastOptions) => number;
  info: (title: string, opts?: ToastOptions) => number;
  warning: (title: string, opts?: ToastOptions) => number;
  dismiss: (id?: number) => void;
}

interface ToneStyle {
  Icon: LucideIcon;
  bg: string;
  fg: string;
}

const TONE: Record<ToastTone, ToneStyle> = {
  success: { Icon: CheckCircle2, bg: 'var(--status-resolved-bg)', fg: 'var(--status-resolved-fg)' },
  error: { Icon: XCircle, bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  info: { Icon: Info, bg: 'var(--status-open-bg)', fg: 'var(--status-open-fg)' },
  warning: { Icon: AlertTriangle, bg: 'var(--status-progress-bg)', fg: 'var(--status-progress-fg)' },
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id?: number) => {
    setToasts((prev) => (id == null ? [] : prev.filter((t) => t.id !== id)));
    if (id == null) {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    } else {
      const timer = timers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }
  }, []);

  const show = useCallback(
    (tone: ToastTone, title: string, opts: ToastOptions = {}) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, tone, title, ...opts }]);
      const duration = opts.duration ?? (tone === 'error' ? 6000 : 4000);
      if (duration > 0) {
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timers.current.delete(id);
        }, duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [],
  );

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, opts) => show('success', title, opts),
      error: (title, opts) => show('error', title, opts),
      info: (title, opts) => show('info', title, opts),
      warning: (title, opts) => show('warning', title, opts),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className={cx(
          'pointer-events-none fixed z-50 flex flex-col-reverse gap-2',
          'inset-x-4 bottom-4 items-stretch',
          'sm:inset-x-auto sm:end-4 sm:bottom-4 sm:max-w-sm sm:items-end',
        )}
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
      <style>{`
        @keyframes pinboard-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: ActiveToast; onClose: () => void }) {
  const tCommon = useTranslations('common');
  const tone = TONE[toast.tone];
  const { Icon } = tone;

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'pointer-events-auto w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]',
        'p-3 shadow-[var(--shadow-md)]',
        'animate-[pinboard-toast-in_180ms_ease-out]',
        'sm:max-w-sm',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-semibold text-[color:var(--text)] break-words">
            {toast.title}
          </div>
          {toast.description && (
            <div className="mt-0.5 text-xs text-[color:var(--text-muted)] break-words">
              {toast.description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('cancel')}
          className="-mt-1 -me-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-faint)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
