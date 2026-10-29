'use client';
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
          <Input name="nameEn" required maxLength={80} defaultValue={c?.nameEn} />
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
        <Button type="submit" disabled={pending}>
          {c ? t('saveCategory') : t('addCategory')}
        </Button>
      </>
    );
  }
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('categories')}</h1>
      <p className="text-[color:var(--text-muted)]">{t('categoryHint')}</p>
      {error && (
        <p role="alert" className="text-[color:var(--danger)]">
          {error}
        </p>
      )}
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <h2 className="mb-4 font-semibold">{t('addCategory')}</h2>
        <form onSubmit={(e) => save(e)}>
          <fieldset disabled={pending} className="grid items-end gap-4 sm:grid-cols-2">
            {fields()}
          </fieldset>
        </form>
      </section>
      {categories.map((c) => (
        <form
          key={`${c.id}:${c.nameEn}:${c.nameAr}:${c.isArchived}`}
          aria-label={c.nameEn}
          onSubmit={(e) => save(e, c.id)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
        >
          <fieldset disabled={pending} className="grid items-end gap-4 sm:grid-cols-2">
            {fields(c)}
          </fieldset>
        </form>
      ))}
    </div>
  );
}
