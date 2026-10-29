'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
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
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/projects/${project.id}/requests`} className="text-sm text-[color:var(--accent)]">
        {project.name} / {t('requests')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('new')}</h1>
      <p className="text-sm text-[color:var(--text-muted)]">
        {t('reporter')}: {reporter}
      </p>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 sm:p-6"
      >
        <fieldset disabled={pending || !categories.length} className="space-y-5">
          <label className="block space-y-2">
            <span>{t('title')}</span>
            <Input name="title" required maxLength={200} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span>{t('category')}</span>
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
              <span>{t('occurredAt')}</span>
              <Input
                name="occurredAt"
                type="datetime-local"
                required
                defaultValue={muscatDateTimeInput(new Date(now))}
              />
            </label>
          </div>
          <label className="block space-y-2">
            <span>{t('shift')}</span>
            <Input name="shift" maxLength={120} />
          </label>
          <label className="block space-y-2">
            <span>{t('description')}</span>
            <Textarea name="description" required rows={6} maxLength={20000} />
          </label>
          <label className="block space-y-2">
            <span>{t('suggestions')}</span>
            <Textarea name="suggestions" rows={4} maxLength={10000} />
          </label>
          <p className="text-sm text-[color:var(--text-muted)]">{t('attachmentAfterCreate')}</p>
          {error && (
            <p role="alert" className="text-[color:var(--danger)]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? t('saving') : t('submit')}
          </Button>
        </fieldset>
        {!categories.length && <p role="alert">{t('noCategories')}</p>}
      </form>
    </div>
  );
}
