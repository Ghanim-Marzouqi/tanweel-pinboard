'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Archive, ArchiveRestore, ArrowLeft, Save, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { sendJson } from '@/lib/client-api';
import { ProjectCreateSchema } from '@/lib/validation';

interface Person {
  id: string;
  name: string;
  username: string;
}

interface Props {
  currentUserId: string;
  project: {
    id: string;
    name: string;
    description: string;
    isArchived: boolean;
    ownerId: string;
    taskCount: number;
  };
  members: (Person & { isActive: boolean })[];
  candidates: Person[];
}

type DetailsValues = { name: string; description: string };

export function ProjectSettings({ currentUserId, project, members, candidates }: Props) {
  const t = useTranslations();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newMemberId, setNewMemberId] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<DetailsValues>({
    resolver: zodResolver(ProjectCreateSchema) as unknown as Resolver<DetailsValues>,
    defaultValues: { name: project.name, description: project.description },
  });

  const base = `/api/projects/${project.id}`;

  function run(action: () => Promise<boolean>) {
    startTransition(async () => {
      if (await action()) router.refresh();
    });
  }

  const saveDetails = handleSubmit((values) =>
    run(async () => {
      const res = await sendJson(base, 'PATCH', values);
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return false;
      }
      toast.success(t('toast.projectSaved'));
      reset(values);
      return true;
    }),
  );

  function addMember() {
    if (!newMemberId) return;
    run(async () => {
      const res = await sendJson(`${base}/members`, 'POST', { userId: newMemberId });
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return false;
      }
      toast.success(t('toast.memberAdded'));
      setNewMemberId('');
      return true;
    });
  }

  async function removeMember(person: Person) {
    const ok = await confirm({
      title: t('confirm.removeMember.title', { name: person.name }),
      description: t('confirm.removeMember.description'),
      confirmLabel: t('projectSettings.remove'),
      tone: 'danger',
    });
    if (!ok) return;
    run(async () => {
      const res = await sendJson(`${base}/members/${person.id}`, 'DELETE');
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return false;
      }
      toast.success(t('toast.memberRemoved'));
      return true;
    });
  }

  async function toggleArchive() {
    const archiving = !project.isArchived;
    if (archiving) {
      const ok = await confirm({
        title: t('confirm.archiveProject.title'),
        description: t('confirm.archiveProject.description'),
        confirmLabel: t('projectSettings.archive'),
      });
      if (!ok) return;
    }
    run(async () => {
      const res = await sendJson(base, 'PATCH', { isArchived: archiving });
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return false;
      }
      toast.success(archiving ? t('toast.projectArchived') : t('toast.projectRestored'));
      return true;
    });
  }

  async function deleteProject() {
    const ok = await confirm({
      title: t('confirm.deleteProject.title'),
      description: t('confirm.deleteProject.description'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await sendJson(base, 'DELETE');
      if (!res.ok) {
        toast.error(t('toast.saveFailed'), { description: res.error });
        return;
      }
      toast.success(t('toast.projectDeleted'));
      router.push('/projects');
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('projectSettings.back')}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t('projectSettings.title')}
        </h1>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 font-semibold tracking-tight">{t('projectSettings.details')}</h2>
        <form onSubmit={saveDetails} className="space-y-5" noValidate>
          <div>
            <Label htmlFor="name">{t('projects.fields.name')}</Label>
            <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
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
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !isDirty}>
              <Save size={16} />
              {pending ? t('projectSettings.saving') : t('projectSettings.save')}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold tracking-tight">{t('projectSettings.members')}</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('projectSettings.membersHint')}</p>

        <ul className="mt-4 divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {m.name}{' '}
                  {m.id === currentUserId && (
                    <span className="font-normal text-[color:var(--text-faint)]">{t('projectSettings.you')}</span>
                  )}
                </div>
                <div className="truncate text-xs text-[color:var(--text-faint)]">@{m.username}</div>
              </div>
              {m.id === project.ownerId ? (
                <span className="rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent-strong)]">
                  {t('projectSettings.ownerBadge')}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMember(m)}
                  disabled={pending}
                  aria-label={`${t('projectSettings.remove')} ${m.name}`}
                >
                  <UserMinus size={14} />
                  <span className="hidden sm:inline">{t('projectSettings.remove')}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>

        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-faint)]">{t('projectSettings.noCandidates')}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Select
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                aria-label={t('projectSettings.addMember')}
              >
                <option value="">{t('projectSettings.selectUser')}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (@{c.username})
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={addMember} disabled={pending || !newMemberId} className="sm:!h-11">
              <UserPlus size={16} />
              {t('projectSettings.add')}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold tracking-tight">{t('projectSettings.archiveTitle')}</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('projectSettings.archiveHint')}</p>
        <Button variant="secondary" className="mt-4" onClick={toggleArchive} disabled={pending}>
          {project.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          {project.isArchived ? t('projectSettings.unarchive') : t('projectSettings.archive')}
        </Button>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold tracking-tight">{t('projectSettings.deleteTitle')}</h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('projectSettings.deleteHint')}</p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={deleteProject}
          disabled={pending || project.taskCount > 0}
        >
          <Trash2 size={16} />
          {t('projectSettings.delete')}
        </Button>
      </Card>
    </div>
  );
}
