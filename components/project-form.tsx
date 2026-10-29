'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Save } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/toast';
import { sendJson } from '@/lib/client-api';
import { ProjectCreateSchema } from '@/lib/validation';

type FormValues = { name: string; description: string };

/** Create a project. Editing happens on the project settings page. */
export function ProjectForm() {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(ProjectCreateSchema) as unknown as Resolver<FormValues>,
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await sendJson<{ project: { id: string } }>('/api/projects', 'POST', values);
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return;
      }
      toast.success(t('toast.projectCreated'));
      router.push(`/projects/${res.data.project.id}`);
      router.refresh();
    });
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('nav.allProjects')}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('projects.form.createTitle')}</h1>
        <p className="text-sm text-[color:var(--text-muted)]">{t('projects.form.createHint')}</p>
      </div>

      <Card className="p-4 sm:p-6">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="name">{t('projects.fields.name')}</Label>
            <Input
              id="name"
              autoFocus
              placeholder={t('projects.fields.namePlaceholder')}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-[color:var(--danger)]">{t('common.required')}</p>
            )}
          </div>
          <div>
            <Label htmlFor="description">{t('projects.fields.description')}</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder={t('projects.fields.descriptionPlaceholder')}
              {...register('description')}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/projects" className={buttonClass({ variant: 'secondary' })}>
              {t('common.cancel')}
            </Link>
            <Button type="submit" disabled={pending}>
              <Save size={16} />
              {pending ? t('projects.form.creating') : t('projects.form.saveCreate')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
