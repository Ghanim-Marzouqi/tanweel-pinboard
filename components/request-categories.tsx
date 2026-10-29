'use client';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendJson } from '@/lib/client-api';
interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
  isArchived: boolean;
}
export function RequestCategories({ categories }: { categories: Category[] }) {
  const t = useTranslations('requests');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError('');
    const result = await sendJson(`/api/request-categories${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', {
      nameEn: data.get('nameEn'),
      nameAr: data.get('nameAr'),
      isArchived: data.get('isArchived') === 'on',
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!id) form.reset();
    router.refresh();
  }
  function fields(c?: Category) {
    return (
      <>
        <label className="block space-y-2">
          <span>{t('englishName')}</span>
          <Input dir="ltr" name="nameEn" required maxLength={80} defaultValue={c?.nameEn} />
        </label>
        <label className="block space-y-2">
          <span>{t('arabicName')}</span>
          <Input name="nameAr" dir="rtl" required maxLength={80} defaultValue={c?.nameAr} />
        </label>
        {c && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isArchived" defaultChecked={c.isArchived} />
            {t('archived')}
          </label>
        )}
        <Button type="submit" disabled={pending} className="justify-self-start">
          {c ? t('saveCategory') : t('addCategory')}
        </Button>
      </>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/requests"
        className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]"
      >
        <ArrowLeft size={16} aria-hidden className="rtl:rotate-180" />
        {t('requests')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('categories')}</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('categorySettingsHint')}</p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-[color:var(--danger-soft)] p-3 text-sm text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 sm:p-6">
        <h2 className="mb-5 flex items-center gap-2 font-semibold">
          <Plus size={17} aria-hidden className="text-[color:var(--accent)]" />
          {t('addCategory')}
        </h2>
        <form onSubmit={(e) => save(e)}>
          <fieldset disabled={pending} className="grid items-end gap-4 sm:grid-cols-2">
            {fields()}
          </fieldset>
        </form>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="border-b border-[color:var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold">
            {t('categoryList')}{' '}
            <span className="ms-2 font-normal text-[color:var(--text-faint)]">{categories.length}</span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">{t('categoryHint')}</p>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {categories.map((c) => (
            <details key={`${c.id}:${c.nameEn}:${c.nameAr}:${c.isArchived}`} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-[color:var(--surface-muted)] [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
                  <Tags size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">{c.nameEn}</span>
                  <span className="mt-0.5 block break-words text-sm text-[color:var(--text-muted)]">
                    <bdi>{c.nameAr}</bdi>
                  </span>
                </span>
                <span
                  className={
                    c.isArchived
                      ? 'rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600'
                      : 'rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700'
                  }
                >
                  {t(c.isArchived ? 'archived' : 'active')}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className="shrink-0 text-[color:var(--text-faint)] transition-transform group-open:rotate-180"
                />
              </summary>
              <form
                aria-label={c.nameEn}
                onSubmit={(e) => save(e, c.id)}
                className="border-t border-[color:var(--border)] bg-[color:var(--background)] px-5 py-5"
              >
                <fieldset disabled={pending} className="grid items-end gap-4 sm:grid-cols-2">
                  {fields(c)}
                </fieldset>
              </form>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
