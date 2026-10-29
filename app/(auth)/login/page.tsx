'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { LogIn, Eye, EyeOff, AlertCircle, User as UserIcon, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocaleToggle } from '@/components/locale-toggle';
import { BrandMark } from '@/components/brand-mark';
import { safeCallbackUrl } from '@/lib/utils';

interface FormValues {
  identifier: string;
  password: string;
  remember: boolean;
}

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tApp = useTranslations('app');
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get('callbackUrl'));
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { identifier: '', password: '', remember: false },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await signIn('credentials', {
        identifier: values.identifier,
        password: values.password,
        remember: String(values.remember),
        redirect: false,
      });
      if (!res || res.error) {
        setServerError(t('invalidCredentials'));
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  });

  return (
    <div className="flex min-h-[100svh] items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-md)] md:grid-cols-2">
        <aside
          className="relative hidden flex-col justify-between p-8 text-white md:flex"
          style={{
            background:
              'linear-gradient(160deg, var(--accent) 0%, var(--accent-strong) 55%, #3b2a6b 100%)',
          }}
        >
          <div className="inline-flex items-center gap-2">
            <BrandMark className="!bg-white/15 ring-1 ring-white/30" />
            <span className="text-base font-semibold tracking-tight">{tApp('brand')}</span>
          </div>
          <div>
            <p className="whitespace-pre-line text-3xl font-semibold leading-tight tracking-tight">{t('heroTitle')}</p>
            <p className="mt-4 max-w-xs text-sm text-white/80">{tApp('tagline')}</p>
          </div>
        </aside>

        <main className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 md:invisible">
              <BrandMark />
              <span className="text-base font-semibold tracking-tight">{tApp('brand')}</span>
            </div>
            <LocaleToggle compact />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('subtitle')}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="identifier">{t('identifier')}</Label>
              <div className="relative">
                <UserIcon
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--text-faint)] start-3"
                />
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('identifierPlaceholder')}
                  aria-invalid={!!errors.identifier}
                  className="ps-9"
                  {...register('identifier', { required: true })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--text-faint)] start-3"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  aria-invalid={!!errors.password}
                  className="ps-9 pe-10"
                  {...register('password', { required: true })}
                />
                <button
                  type="button"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  title={showPassword ? t('hidePassword') : t('showPassword')}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-faint)] hover:text-[color:var(--text)] end-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--text-muted)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--border-strong)] accent-[color:var(--accent)]"
                {...register('remember')}
              />
              {t('remember')}
            </label>

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger)]"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full !h-12" disabled={pending}>
              <LogIn size={18} />
              {pending ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <p className="mt-6 text-xs text-[color:var(--text-faint)]">{t('noAccount')}</p>
        </main>
      </div>
    </div>
  );
}
