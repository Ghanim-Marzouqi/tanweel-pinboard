import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';
import type { Role } from '@/lib/roles';

const STYLES: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: 'var(--role-admin-bg)', fg: 'var(--role-admin-fg)' },
  member: { bg: 'var(--role-member-bg)', fg: 'var(--role-member-fg)' },
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const t = useTranslations();
  const style = STYLES[role];
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {t(`roles.${role}`)}
    </span>
  );
}
