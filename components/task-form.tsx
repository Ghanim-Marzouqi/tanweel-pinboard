'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, FolderInput, Trash2, Save } from 'lucide-react';
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
import { sendJson } from '@/lib/client-api';
import { PRIORITY_KEY, STATUS_KEY, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/status';
import { TaskFormSchema, type TaskPriority, type TaskStatus } from '@/lib/validation';

export interface ExistingAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedById: string;
}

interface TaskFormProps {
  mode: 'create' | 'edit';
  project: { id: string; name: string };
  /** Archived project: nothing can be changed. */
  readOnly?: boolean;
  /** Creator, project owner or admin. */
  canDelete?: boolean;
  /** Project owner or admin: may remove other people's comments and files. */
  canModerate?: boolean;
  /** Active project members, for the assignee picker and @mentions. */
  people: { id: string; name: string; username: string }[];
  /** Other projects this task can be moved to (edit mode). */
  moveTargets?: { id: string; name: string }[];
  initial?: {
    id: string;
    title: string;
    descriptionHtml: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    assignee: { id: string; name: string } | null;
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
  priority: TaskPriority;
  /** "" = no due date */
  dueDate: string;
  /** "" = unassigned */
  assigneeId: string;
};

export function TaskForm({
  mode,
  project,
  readOnly = false,
  canDelete = false,
  canModerate = false,
  people,
  moveTargets = [],
  initial,
}: TaskFormProps) {
  const t = useTranslations();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const projectUrl = `/projects/${project.id}`;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(TaskFormSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      title: initial?.title ?? '',
      descriptionHtml: initial?.descriptionHtml ?? '',
      status: initial?.status ?? 'Todo',
      priority: initial?.priority ?? 'Medium',
      dueDate: initial?.dueDate ?? '',
      assigneeId: initial?.assignee?.id ?? '',
    },
  });
  const [moveTo, setMoveTo] = useState('');

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
          const res = await sendJson<{ task: { id: string } }>(
            `/api/projects/${project.id}/tasks`,
            'POST',
            values,
          );
          if (!res.ok) throw new Error(res.error);
          if (pendingFiles.length) {
            await uploadFiles(res.data.task.id, pendingFiles);
          }
          toast.success(t('toast.taskCreated'));
        } else if (initial) {
          const res = await sendJson(`/api/tasks/${initial.id}`, 'PUT', values);
          if (!res.ok) throw new Error(res.error);
          toast.success(t('toast.taskSaved'));
        }
        router.push(projectUrl);
        router.refresh();
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
      const res = await sendJson(`/api/tasks/${initial.id}`, 'DELETE');
      if (res.ok) {
        toast.success(t('toast.taskDeleted'));
        router.push(projectUrl);
        router.refresh();
      } else {
        toast.error(t('toast.taskDeleteFailed'), { description: res.error });
      }
    });
  }

  function handleMove() {
    if (!initial || !moveTo) return;
    startTransition(async () => {
      const res = await sendJson<{ unassigned: boolean }>(`/api/tasks/${initial.id}`, 'PUT', {
        projectId: moveTo,
      });
      if (!res.ok) {
        toast.error(t('toast.taskSaveFailed'), { description: res.error });
        return;
      }
      toast.success(res.data.unassigned ? t('toast.taskMovedUnassigned') : t('toast.taskMoved'));
      setMoveTo('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <Link
          href={projectUrl}
          className="inline-flex max-w-full items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={16} className="shrink-0 rtl:rotate-180" />
          <span className="truncate">{project.name}</span>
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

      {readOnly && (
        <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          {t('tasks.archivedNotice')}
        </p>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
        <Card className="p-4 sm:p-6">
          <fieldset disabled={readOnly} className="space-y-5">
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
                    readOnly={readOnly}
                  />
                )}
              />
            </div>
          </fieldset>

          <div className="mt-5">
            <TaskAttachments
              taskId={initial?.id}
              existing={initial?.attachments ?? []}
              pendingFiles={pendingFiles}
              onPendingChange={setPendingFiles}
              mode={mode}
              readOnly={readOnly}
              canModerate={canModerate}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-6">
            <fieldset disabled={readOnly} className="space-y-4">
              <div>
                <Label htmlFor="status">{t('tasks.fields.status')}</Label>
                <Select id="status" {...register('status')}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`tasks.status.${STATUS_KEY[s]}`)}
                    </option>
                  ))}
                </Select>
                <div className="mt-2">
                  <StatusBadge status={watchedStatus} />
                </div>
              </div>

              <div>
                <Label htmlFor="assigneeId">{t('tasks.fields.assignee')}</Label>
                <Select id="assigneeId" {...register('assigneeId')}>
                  <option value="">{t('tasks.fields.unassigned')}</option>
                  {/* Keep a deactivated or departed assignee visible until changed. */}
                  {initial?.assignee && !people.some((p) => p.id === initial.assignee!.id) && (
                    <option value={initial.assignee.id}>{initial.assignee.name}</option>
                  )}
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">{t('tasks.fields.priority')}</Label>
                <Select id="priority" {...register('priority')}>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`tasks.priority.${PRIORITY_KEY[p]}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate">{t('tasks.fields.dueDate')}</Label>
                <Input id="dueDate" type="date" {...register('dueDate')} />
              </div>
            </fieldset>
          </Card>

          {!readOnly && (
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
                <Link href={projectUrl} className={buttonClass({ variant: 'secondary' })}>
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
          )}

          {mode === 'edit' && !readOnly && moveTargets.length > 0 && (
            <Card className="p-4">
              <Label htmlFor="moveTo">{t('tasks.move.title')}</Label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Select id="moveTo" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                    <option value="">{t('tasks.move.selectProject')}</option>
                    {moveTargets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  className="!h-11 shrink-0"
                  onClick={handleMove}
                  disabled={pending || !moveTo}
                >
                  <FolderInput size={16} />
                  {t('tasks.move.move')}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </form>

      {mode === 'edit' && initial && (
        <CommentsSection taskId={initial.id} people={people} readOnly={readOnly} canModerate={canModerate} />
      )}
    </div>
  );
}
