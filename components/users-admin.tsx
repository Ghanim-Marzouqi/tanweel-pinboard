'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { KeyRound, MailCheck, Pencil, Plus, UserCheck, UserX, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { RoleBadge } from '@/components/role-badge';
import { FormattedDate } from '@/components/formatted-date';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { sendJson } from '@/lib/client-api';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import { ROLES, type Role } from '@/lib/roles';
import { cx } from '@/lib/utils';
import { PasswordResetSchema, UserCreateSchema, UserUpdateSchema } from '@/lib/validation';

export interface AdminUserRow {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; user: AdminUserRow }
  | { kind: 'reset'; user: AdminUserRow }
  | null;

/** Readable random password (no 0/O, 1/l/I). */
function generatePassword(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Map an API error to a translated message. */
function useErrorMessage() {
  const t = useTranslations('users.errors');
  return (status: number, error: string) => {
    if (status === 409) return t('taken');
    if (error.includes('At least one active admin')) return t('lastAdmin');
    if (error.includes('your own admin access')) return t('self');
    return error;
  };
}

export function UsersAdmin({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const t = useTranslations('users');
  const tToast = useTranslations('toast');
  const tConfirm = useTranslations('confirm.deactivateUser');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, startTransition] = useTransition();

  async function setActive(user: AdminUserRow, isActive: boolean) {
    if (!isActive) {
      const ok = await confirm({
        title: tConfirm('title', { name: user.name }),
        description: tConfirm('description'),
        confirmLabel: t('deactivate'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await sendJson(`/api/admin/users/${user.id}`, 'PATCH', { isActive });
      if (!res.ok) {
        toast.error(tToast('saveFailed'), { description: errorMessage(res.status, res.error) });
        return;
      }
      toast.success(tToast('userSaved'));
      router.refresh();
    });
  }

  function sendTestEmail() {
    startTransition(async () => {
      const res = await sendJson<{ to: string }>('/api/admin/test-email', 'POST');
      if (res.ok) toast.success(t('testEmailSent', { to: res.data.to }));
      else toast.error(res.status === 400 ? t('testEmailNoAddress') : tToast('saveFailed'), { description: res.error });
    });
  }

  function closeAndRefresh() {
    setDialog(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={sendTestEmail} disabled={pending}>
            <MailCheck size={16} />
            {t('testEmail')}
          </Button>
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus size={16} />
            {t('addUser')}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('fields.name')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fields.role')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fields.status')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fields.lastLogin')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className={cx('border-t border-[color:var(--border)]', !u.isActive && 'opacity-60')}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="ms-2 text-xs font-normal text-[color:var(--text-faint)]">
                            ({t('you')})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[color:var(--text-faint)]">
                        @{u.username}
                        {u.email && <> · {u.email}</>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {!u.isActive ? (
                        <span className="text-[color:var(--text-muted)]">{t('inactive')}</span>
                      ) : u.mustChangePassword ? (
                        <span className="text-[color:var(--warning)]">{t('pendingPassword')}</span>
                      ) : (
                        <span className="text-[color:var(--success)]">{t('active')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[color:var(--text-muted)]">
                      {u.lastLoginAt ? <FormattedDate iso={u.lastLoginAt} /> : t('never')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={t('edit')} onClick={() => setDialog({ kind: 'edit', user: u })}>
                          <Pencil size={15} />
                        </IconButton>
                        {!isSelf && (
                          <>
                            <IconButton
                              label={t('resetPassword')}
                              onClick={() => setDialog({ kind: 'reset', user: u })}
                            >
                              <KeyRound size={15} />
                            </IconButton>
                            {u.isActive ? (
                              <IconButton
                                label={t('deactivate')}
                                onClick={() => setActive(u, false)}
                                disabled={pending}
                                danger
                              >
                                <UserX size={15} />
                              </IconButton>
                            ) : (
                              <IconButton
                                label={t('reactivate')}
                                onClick={() => setActive(u, true)}
                                disabled={pending}
                              >
                                <UserCheck size={15} />
                              </IconButton>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={dialog?.kind === 'create'}
        onClose={() => setDialog(null)}
        title={t('createTitle')}
        description={t('createHint')}
      >
        {dialog?.kind === 'create' && <CreateUserForm onDone={closeAndRefresh} onCancel={() => setDialog(null)} />}
      </Dialog>

      <Dialog
        open={dialog?.kind === 'edit'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'edit' ? t('editTitle', { name: dialog.user.name }) : ''}
      >
        {dialog?.kind === 'edit' && (
          <EditUserForm
            user={dialog.user}
            isSelf={dialog.user.id === currentUserId}
            onDone={closeAndRefresh}
            onCancel={() => setDialog(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog?.kind === 'reset'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'reset' ? t('resetTitle', { name: dialog.user.name }) : ''}
        description={t('resetHint')}
      >
        {dialog?.kind === 'reset' && (
          <ResetPasswordForm user={dialog.user} onDone={closeAndRefresh} onCancel={() => setDialog(null)} />
        )}
      </Dialog>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-muted)] disabled:opacity-40',
        danger
          ? 'hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)]'
          : 'hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]',
      )}
    >
      {children}
    </button>
  );
}

function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  return show ? <p className="mt-1.5 text-xs text-[color:var(--danger)]">{children}</p> : null;
}

function FormActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel}>
        {tCommon('cancel')}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

/** Temporary password input with a "Generate" button that reveals the value. */
function TempPasswordField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  const t = useTranslations('users');
  const tAccount = useTranslations('account');
  return (
    <div>
      <Label htmlFor="temp-password">{t('fields.password')}</Label>
      <div className="flex gap-2">
        <Input
          id="temp-password"
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
        <Button variant="secondary" className="!h-11 shrink-0" onClick={() => onChange(generatePassword())}>
          <Wand2 size={16} />
          {t('generate')}
        </Button>
      </div>
      <p className={cx('mt-1.5 text-xs', invalid ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-faint)]')}>
        {tAccount('passwordHint', { min: MIN_PASSWORD_LENGTH })}
      </p>
    </div>
  );
}

type CreateValues = { username: string; name: string; email: string; role: Role; password: string };

function CreateUserForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations('users');
  const tToast = useTranslations('toast');
  const tRoles = useTranslations('roles');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [initialPassword] = useState(generatePassword);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(UserCreateSchema) as unknown as Resolver<CreateValues>,
    defaultValues: { username: '', name: '', email: '', role: 'member', password: initialPassword },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await sendJson('/api/admin/users', 'POST', values);
      if (!res.ok) {
        toast.error(tToast('saveFailed'), { description: errorMessage(res.status, res.error) });
        return;
      }
      toast.success(tToast('userCreated'));
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="new-username">{t('fields.username')}</Label>
        <Input
          id="new-username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!errors.username}
          {...register('username')}
        />
        <p
          className={cx(
            'mt-1.5 text-xs',
            errors.username ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-faint)]',
          )}
        >
          {t('fields.usernameHint')}
        </p>
      </div>
      <div>
        <Label htmlFor="new-name">{t('fields.name')}</Label>
        <Input id="new-name" autoComplete="off" aria-invalid={!!errors.name} {...register('name')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <Label htmlFor="new-email">{t('fields.email')}</Label>
          <Input id="new-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register('email')} />
          <FieldError show={!!errors.email}>{t('errors.invalid')}</FieldError>
        </div>
        <div>
          <Label htmlFor="new-role">{t('fields.role')}</Label>
          <Select id="new-role" {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <TempPasswordField
        value={password}
        onChange={(v) => setValue('password', v, { shouldValidate: !!errors.password })}
        invalid={!!errors.password}
      />
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

type EditValues = { name: string; email: string; role: Role };

function EditUserForm({
  user,
  isSelf,
  onDone,
  onCancel,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('users');
  const tToast = useTranslations('toast');
  const tRoles = useTranslations('roles');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(UserUpdateSchema) as unknown as Resolver<EditValues>,
    defaultValues: { name: user.name, email: user.email ?? '', role: user.role },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      // Admins can't change their own role here (that's how lock-outs happen).
      const body = isSelf ? { name: values.name, email: values.email } : values;
      const res = await sendJson(`/api/admin/users/${user.id}`, 'PATCH', body);
      if (!res.ok) {
        toast.error(tToast('saveFailed'), { description: errorMessage(res.status, res.error) });
        return;
      }
      toast.success(tToast('userSaved'));
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="edit-username">{t('fields.username')}</Label>
        <Input id="edit-username" value={user.username} disabled readOnly />
      </div>
      <div>
        <Label htmlFor="edit-name">{t('fields.name')}</Label>
        <Input id="edit-name" aria-invalid={!!errors.name} {...register('name')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <Label htmlFor="edit-email">{t('fields.email')}</Label>
          <Input id="edit-email" type="email" aria-invalid={!!errors.email} {...register('email')} />
          <FieldError show={!!errors.email}>{t('errors.invalid')}</FieldError>
        </div>
        <div>
          <Label htmlFor="edit-role">{t('fields.role')}</Label>
          <Select id="edit-role" disabled={isSelf} {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

function ResetPasswordForm({
  user,
  onDone,
  onCancel,
}: {
  user: AdminUserRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const tToast = useTranslations('toast');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [initialPassword] = useState(generatePassword);
  const {
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<{ password: string }>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: { password: initialPassword },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await sendJson(`/api/admin/users/${user.id}/password`, 'POST', values);
      if (!res.ok) {
        toast.error(tToast('saveFailed'), { description: errorMessage(res.status, res.error) });
        return;
      }
      toast.success(tToast('passwordReset'));
      onDone();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <TempPasswordField
        value={password}
        onChange={(v) => setValue('password', v, { shouldValidate: !!errors.password })}
        invalid={!!errors.password}
      />
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
