import { cx } from '@/lib/utils';
import type { REQUEST_STATUSES } from '@/lib/request-validation';

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const requestStatusTone: Record<RequestStatus, string> = {
  New: 'bg-sky-50 text-sky-700',
  UnderReview: 'bg-amber-50 text-amber-800',
  Accepted: 'bg-emerald-50 text-emerald-700',
  Closed: 'bg-stone-100 text-stone-600',
};

export function RequestStatusBadge({ status, label }: { status: RequestStatus; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
        requestStatusTone[status],
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
