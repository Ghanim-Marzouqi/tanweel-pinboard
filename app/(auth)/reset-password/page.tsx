'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, KeyRound, TriangleAlert } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button, buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendJson } from '@/lib/client-api';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

type Result = 'done' | 'invalid' | null;

export default function ResetPasswordPage() {
  const t = useTranslations();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(token ? null : 'invalid');
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('account.errors.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('account.errors.mismatch'));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sendJson('/api/password-reset/confirm', 'POST', { token, password });
      setResult(res.ok ? 'done' : 'invalid');
    });
  }

  return (
    <AuthCard brand={t('app.brand')}>
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.reset.title')}</h1>

      {result === 'done' && (
        <>
          <div role="status" className="mt-4 flex items-start gap-3 rounded-lg bg-[color:var(--accent-soft)] p-4 text-sm">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[color:var(--success)]" />
            <p>{t('auth.reset.done')}</p>
          </div>
          <Link href="/login" className={buttonClass({ size: 'lg', className: 'mt-6 w-full' })}>
            {t('auth.reset.signIn')}
          </Link>
        </>
      )}

      {result === 'invalid' && (
        <>
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg bg-[color:var(--danger-soft)] p-4 text-sm text-[color:var(--danger)]">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <p>{t('auth.reset.invalid')}</p>
          </div>
          <Link href="/forgot-password" className={buttonClass({ variant: 'secondary', className: 'mt-6 w-full' })}>
            {t('auth.reset.requestNew')}
          </Link>
        </>
      )}

      {result === null && (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <input type="text" name="username" autoComplete="username" hidden readOnly />
          <div>
            <Label htmlFor="password">{t('account.newPassword')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-[color:var(--text-faint)]">
              {t('account.passwordHint', { min: MIN_PASSWORD_LENGTH })}
            </p>
          </div>
          <div>
            <Label htmlFor="confirm">{t('account.confirmPassword')}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-[color:var(--danger)]">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            <KeyRound size={16} />
            {pending ? t('auth.reset.saving') : t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
