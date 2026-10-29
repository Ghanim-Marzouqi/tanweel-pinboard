'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { AuthCard } from '@/components/auth-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendJson } from '@/lib/client-api';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tApp = useTranslations('app');
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    startTransition(async () => {
      // The answer is the same whether or not the account exists.
      await sendJson('/api/password-reset/request', 'POST', { identifier });
      setSent(true);
    });
  }

  return (
    <AuthCard brand={tApp('brand')}>
      <h1 className="text-2xl font-semibold tracking-tight">{t('forgot.title')}</h1>
      {sent ? (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-lg bg-[color:var(--accent-soft)] p-4 text-sm">
          <MailCheck size={18} className="mt-0.5 shrink-0 text-[color:var(--accent-strong)]" />
          <p>{t('forgot.sent')}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('forgot.subtitle')}</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="identifier">{t('login.identifier')}</Label>
              <Input
                id="identifier"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending || !identifier.trim()}>
              <Send size={16} />
              {pending ? t('forgot.sending') : t('forgot.submit')}
            </Button>
          </form>
          <p className="mt-4 text-xs text-[color:var(--text-faint)]">{t('forgot.noEmail')}</p>
        </>
      )}
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 text-sm text-[color:var(--accent-strong)] hover:underline"
      >
        <ArrowLeft size={14} className="rtl:rotate-180" />
        {t('forgot.back')}
      </Link>
    </AuthCard>
  );
}
