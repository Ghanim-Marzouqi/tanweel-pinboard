'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCheck, FileText, Link2, Paperclip, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { sendJson } from '@/lib/client-api';
import { muscatDateTimeInput } from '@/lib/request-validation';
export function RequestCreate({
  project,
  categories,
  reporter,
  now,
}: {
  project: { id: string; name: string };
  categories: { id: string; nameEn: string; nameAr: string }[];
  reporter: string;
  now: string;
}) {
  const t = useTranslations('requests');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError('');
    const res = await sendJson<{ request: { id: string } }>(`/api/projects/${project.id}/requests`, 'POST', {
      title: form.get('title'),
      description: form.get('description'),
      suggestions: form.get('suggestions'),
      shift: form.get('shift'),
      categoryId: form.get('categoryId'),
      occurredAt: new Date(`${form.get('occurredAt')}:00+04:00`).toISOString(),
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.push(`/requests/${res.data.request.id}`);
    router.refresh();
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/projects/${project.id}/requests`}
        className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]"
      >
        <ArrowLeft size={16} aria-hidden className="rtl:rotate-180" />
        {project.name} / {t('requests')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('new')}</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('createHint')}</p>
      </header>
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
        <fieldset
          disabled={pending || !categories.length}
          className="min-w-0 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-sm)]"
        >
          <div className="space-y-5 p-5 sm:p-7">
            <div className="flex items-center gap-2 font-semibold">
              <FileText size={18} aria-hidden className="text-[color:var(--accent)]" />
              <h2>{t('requestDetails')}</h2>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{t('title')}</span>
              <Input name="title" required maxLength={200} placeholder={t('titlePlaceholder')} dir="auto" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{t('category')}</span>
              <Select aria-label={t('category')} name="categoryId" required defaultValue="">
                <option value="" disabled>
                  {t('chooseCategory')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === 'ar' ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{t('description')}</span>
              <Textarea
                name="description"
                dir="auto"
                required
                rows={6}
                maxLength={20000}
                placeholder={t('descriptionPlaceholder')}
              />
            </label>
          </div>
          <div className="space-y-5 border-t border-[color:var(--border)] bg-[color:var(--background)]/60 p-5 sm:p-7">
            <div>
              <h2 className="text-sm font-semibold">{t('additionalContext')}</h2>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t('contextHint')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block min-w-0 space-y-2">
                <span className="text-sm font-medium">{t('occurredAt')}</span>
                <Input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={muscatDateTimeInput(new Date(now))}
                />
              </label>
              <label className="block min-w-0 space-y-2">
                <span className="text-sm font-medium">{t('shift')}</span>
                <Input name="shift" maxLength={120} placeholder={t('shiftPlaceholder')} />
              </label>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">{t('suggestions')}</span>
              <Textarea
                name="suggestions"
                dir="auto"
                rows={3}
                maxLength={10000}
                placeholder={t('suggestionsPlaceholder')}
              />
            </label>
          </div>
          <div className="border-t border-[color:var(--border)] p-5 sm:px-7">
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/projects/${project.id}/requests`}
                className="text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >
                {t('cancel')}
              </Link>
              <Button type="submit" disabled={pending}>
                {pending ? t('saving') : t('submit')}
                <ArrowRight size={16} aria-hidden className="rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </fieldset>
        <aside className="min-w-0 space-y-6 lg:pt-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] font-semibold text-[color:var(--accent-strong)]"
            >
              {reporter.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[color:var(--text-muted)]">{t('reporter')}</p>
              <p className="mt-1 truncate text-sm font-medium">{reporter}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <ShieldCheck size={19} aria-hidden className="mb-2 text-[color:var(--accent)]" />
            <h2 className="text-sm font-semibold">{t('privateRequest')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-muted)]">{t('privacyHint')}</p>
          </div>
          <div>
            <h2 className="mb-4 text-sm font-semibold">{t('whatNext')}</h2>
            <ul className="space-y-4 text-xs leading-relaxed text-[color:var(--text-muted)]">
              <li className="flex gap-2.5">
                <CheckCheck size={17} className="mt-0.5 shrink-0" aria-hidden />
                <span>{t('nextReview')}</span>
              </li>
              <li className="flex gap-2.5">
                <Link2 size={17} className="mt-0.5 shrink-0" aria-hidden />
                <span>{t('nextLink')}</span>
              </li>
              <li className="flex gap-2.5">
                <Paperclip size={17} className="mt-0.5 shrink-0" aria-hidden />
                <span>{t('attachmentAfterCreate')}</span>
              </li>
            </ul>
          </div>
          {!categories.length && (
            <p
              role="alert"
              className="rounded-lg bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]"
            >
              {t('noCategories')}
            </p>
          )}
        </aside>
      </form>
    </div>
  );
}
