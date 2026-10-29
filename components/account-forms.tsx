'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { KeyRound, Save, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/toast';
import { sendJson } from '@/lib/client-api';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import { AccountUpdateSchema, PasswordChangeSchema } from '@/lib/validation';

interface Props {
  user: { username: string; name: string; email: string | null; mustChangePassword: boolean };
}

export function AccountForms({ user }: Props) {
  const t = useTranslations('account');
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('title')}</h1>
      {user.mustChangePassword ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-4">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-[color:var(--accent-strong)]" />
            <div>
              <p className="font-semibold">{t('mustChangeTitle')}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('mustChange')}</p>
            </div>
          </div>
          <PasswordForm username={user.username} forced />
        </>
      ) : (
        <>
          <ProfileForm user={user} />
          <PasswordForm username={user.username} />
        </>
      )}
    </div>
  );
}

type ProfileValues = { name: string; email: string };

function ProfileForm({ user }: Props) {
  const t = useTranslations('account');
  const tToast = useTranslations('toast');
  const toast = useToast();
  const router = useRouter();
  const { update } = useSession();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(AccountUpdateSchema) as unknown as Resolver<ProfileValues>,
    defaultValues: { name: user.name, email: user.email ?? '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await sendJson('/api/account', 'PATCH', values);
      if (!res.ok) {
        if (res.status === 409) setError('email', { type: 'taken' });
        else toast.error(tToast('saveFailed'), { description: res.error });
        return;
      }
      toast.success(tToast('profileSaved'));
      reset(values);
      // Refresh the name shown in the header.
      await update();
      router.refresh();
    });
  });

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-4 font-semibold tracking-tight">{t('profile')}</h2>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="username">{t('username')}</Label>
          <Input id="username" value={user.username} disabled readOnly />
        </div>
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
        </div>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          <p className="mt-1.5 text-xs text-[color:var(--text-faint)]">{t('emailHint')}</p>
          {errors.email && (
            <p className="mt-1 text-xs text-[color:var(--danger)]">
              {errors.email.type === 'taken' ? t('errors.emailTaken') : t('errors.invalidEmail')}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !isDirty}>
            <Save size={16} />
            {pending ? t('saving') : t('saveProfile')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const PasswordFormSchema = PasswordChangeSchema.and(
  z.object({ confirmPassword: z.string() }),
).refine((v) => v.confirmPassword === v.newPassword, {
  path: ['confirmPassword'],
  message: 'mismatch',
});

type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };

function PasswordForm({ username, forced = false }: { username: string; forced?: boolean }) {
  const t = useTranslations('account');
  const tToast = useTranslations('toast');
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(PasswordFormSchema) as unknown as Resolver<PasswordValues>,
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await sendJson('/api/account/password', 'POST', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (!res.ok) {
        if (res.status === 429) setError('currentPassword', { message: 'tooManyAttempts' });
        else if (res.status === 400) setError('currentPassword', { message: 'wrongCurrent' });
        else toast.error(tToast('saveFailed'), { description: res.error });
        return;
      }
      // The change ended every session, including this one; sign straight
      // back in with the new password.
      const again = await signIn('credentials', {
        identifier: username,
        password: values.newPassword,
        redirect: false,
      });
      if (!again || again.error) {
        await signOut({ callbackUrl: '/login' });
        return;
      }
      if (forced) {
        // Full page load on purpose: the client router cache still holds the
        // earlier "redirect to /account" answers, so a soft navigation would
        // bounce straight back here.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/');
        return;
      }
      toast.success(tToast('passwordChanged'));
      reset();
    });
  });

  function errorText(message: string | undefined): string | null {
    if (!message) return null;
    switch (message) {
      case 'mismatch':
      case 'wrongCurrent':
      case 'tooManyAttempts':
        return t(`errors.${message}`);
      case 'same_as_current':
        return t('errors.sameAsCurrent');
      default:
        return t('errors.tooShort', { min: MIN_PASSWORD_LENGTH });
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-4 font-semibold tracking-tight">{t('password')}</h2>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/* Lets password managers attach the new password to the right account. */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        <PasswordField
          id="currentPassword"
          label={t('currentPassword')}
          autoComplete="current-password"
          error={errorText(errors.currentPassword?.message)}
          {...register('currentPassword')}
        />
        <PasswordField
          id="newPassword"
          label={t('newPassword')}
          autoComplete="new-password"
          hint={t('passwordHint', { min: MIN_PASSWORD_LENGTH })}
          error={errorText(errors.newPassword?.message)}
          {...register('newPassword')}
        />
        <PasswordField
          id="confirmPassword"
          label={t('confirmPassword')}
          autoComplete="new-password"
          error={errorText(errors.confirmPassword?.message)}
          {...register('confirmPassword')}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <KeyRound size={16} />
            {pending ? t('changing') : t('changePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type PasswordFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
};

function PasswordField({ id, label, hint, error, ...input }: PasswordFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" aria-invalid={!!error} {...input} />
      {hint && !error && <p className="mt-1.5 text-xs text-[color:var(--text-faint)]">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}
