'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2, Save } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RichTextEditor } from '@/components/rich-text-editor';
import { StatusBadge } from '@/components/status-badge';
import { TaskAttachments } from '@/components/task-attachments';
import { CommentsSection } from '@/components/comments-section';
import { FormattedDate } from '@/components/formatted-date';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { TaskCreateSchema, type TaskStatus } from '@/lib/validation';

const STATUS_OPTIONS: TaskStatus[] = ['Open', 'InProgress', 'Resolved', 'Closed'];

export interface ExistingAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface TaskFormProps {
  mode: 'create' | 'edit';
  /** Only the creator or an admin may delete a task. */
  canDelete?: boolean;
  initial?: {
    id: string;
    title: string;
    descriptionHtml: string;
    status: TaskStatus;
    createdAt: string;
    updatedAt: string;
    createdByName: string;
    attachments: ExistingAttachment[];
  };
}

type FormValues = {
  title: string;
  descriptionHtml: string;
  status: TaskStatus;
};

export function TaskForm({ mode, canDelete = false, initial }: TaskFormProps) {
  const t = useTranslations();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(TaskCreateSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: initial?.title ?? '',
      descriptionHtml: initial?.descriptionHtml ?? '',
      status: initial?.status ?? 'Open',
    },
  });

  const watchedStatus = useWatch({ control, name: 'status' });

  async function uploadFiles(taskId: string, files: File[]): Promise<void> {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        throw new Error(`Upload failed for ${file.name}`);
      }
    }
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        if (mode === 'create') {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          if (!res.ok) throw new Error(await res.text());
          const { task } = (await res.json()) as { task: { id: string } };
          if (pendingFiles.length) {
            await uploadFiles(task.id, pendingFiles);
          }
          toast.success(t('toast.taskCreated'));
          router.push('/tasks');
          router.refresh();
        } else if (initial) {
          const res = await fetch(`/api/tasks/${initial.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          if (!res.ok) throw new Error(await res.text());
          toast.success(t('toast.taskSaved'));
          router.push('/tasks');
          router.refresh();
        }
      } catch (err) {
        toast.error(t('toast.taskSaveFailed'), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    });
  });

  async function handleDelete() {
    if (!initial) return;
    const ok = await confirm({
      title: t('confirm.deleteTask.title'),
      description: t('confirm.deleteTask.description'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${initial.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('toast.taskDeleted'));
        router.push('/tasks');
        router.refresh();
      } else {
        toast.error(t('toast.taskDeleteFailed'));
      }
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('tasks.back')}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {mode === 'create' ? t('tasks.form.createTitle') : t('tasks.form.editTitle')}
          </h1>
          {mode === 'edit' && initial && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[color:var(--text-faint)]">
              <span>{t('tasks.fields.createdBy')}:</span>
              <span className="font-medium text-[color:var(--text-muted)]">
                {initial.createdByName}
              </span>
              <span>·</span>
              <FormattedDate iso={initial.createdAt} />
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
        <Card className="p-4 sm:p-6">
          <div className="space-y-5">
            <div>
              <Label htmlFor="title">{t('tasks.fields.title')}</Label>
              <Input
                id="title"
                placeholder={t('tasks.fields.titlePlaceholder')}
                {...register('title')}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="mt-1.5 text-xs text-[color:var(--danger)]">
                  {errors.title.message ?? t('common.required')}
                </p>
              )}
            </div>

            <div>
              <Label>{t('tasks.fields.description')}</Label>
              <Controller
                control={control}
                name="descriptionHtml"
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder={t('tasks.fields.descriptionPlaceholder')}
                    ariaLabel={t('tasks.fields.description')}
                  />
                )}
              />
            </div>

            <TaskAttachments
              taskId={initial?.id}
              existing={initial?.attachments ?? []}
              pendingFiles={pendingFiles}
              onPendingChange={setPendingFiles}
              mode={mode}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="status">{t('tasks.fields.status')}</Label>
                <Select id="status" {...register('status')}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`tasks.status.${s === 'InProgress' ? 'inProgress' : s.toLowerCase()}`)}
                    </option>
                  ))}
                </Select>
                <div className="mt-2">
                  <StatusBadge status={watchedStatus} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={pending}>
                <Save size={16} />
                {pending
                  ? mode === 'create'
                    ? t('tasks.form.creating')
                    : t('tasks.form.saving')
                  : mode === 'create'
                    ? t('tasks.form.saveCreate')
                    : t('tasks.form.saveEdit')}
              </Button>
              <Link href="/tasks" className={buttonClass({ variant: 'secondary' })}>
                {t('common.cancel')}
              </Link>
              {mode === 'edit' && canDelete && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDelete}
                  disabled={pending}
                  className="!text-[color:var(--danger)] !border-[color:var(--danger)]/30 hover:!bg-[color:var(--danger-soft)] hover:!border-[color:var(--danger)]/50"
                >
                  <Trash2 size={16} />
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </form>

      {mode === 'edit' && initial && <CommentsSection taskId={initial.id} />}
    </div>
  );
}
