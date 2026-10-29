'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Send, Pencil, Trash2, X, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { RoleBadge } from '@/components/role-badge';
import { FormattedDate } from '@/components/formatted-date';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { cx } from '@/lib/utils';
import type { Role } from '@/lib/roles';

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; role: Role };
}

export function CommentsSection({
  taskId,
  readOnly = false,
  canModerate = false,
}: {
  taskId: string;
  /** Archived project: show the thread only. */
  readOnly?: boolean;
  /** Project owner or admin: may delete anyone's comment. */
  canModerate?: boolean;
}) {
  const t = useTranslations('comments');
  const tConfirm = useTranslations('confirm.deleteComment');
  const tCommon = useTranslations('common');
  const tToast = useTranslations('toast');
  const confirm = useConfirm();
  const toast = useToast();
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, startPosting] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}/comments`)
      .then((res) => {
        if (!res.ok) throw new Error('load_failed');
        return res.json() as Promise<{ comments: Comment[] }>;
      })
      .then((data) => {
        if (!cancelled) setComments(data.comments);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadFailed'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  function postComment() {
    if (!draft.trim()) return;
    startPosting(async () => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (!res.ok) {
        toast.error(tToast('commentSaveFailed'));
        return;
      }
      const { comment } = (await res.json()) as { comment: Comment };
      setComments((prev) => [...(prev ?? []), comment]);
      setDraft('');
    });
  }

  async function saveEdit(id: string) {
    const body = editingDraft.trim();
    if (!body) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('save_failed');
      const { comment } = (await res.json()) as { comment: Comment };
      setComments((prev) => prev?.map((c) => (c.id === id ? comment : c)) ?? null);
      setEditingId(null);
      setEditingDraft('');
    } catch {
      toast.error(tToast('commentSaveFailed'));
    } finally {
      setBusyId(null);
    }
  }

  async function removeComment(id: string) {
    const ok = await confirm({
      title: tConfirm('title'),
      description: tConfirm('description'),
      confirmLabel: tCommon('delete'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setComments((prev) => prev?.filter((c) => c.id !== id) ?? null);
    } catch {
      toast.error(tToast('commentDeleteFailed'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <MessageSquare size={18} className="text-[color:var(--accent)]" />
        <h2 className="text-lg font-semibold tracking-tight">{t('title')}</h2>
        <span className="hidden text-sm text-[color:var(--text-faint)] sm:inline">— {t('subtitle')}</span>
      </div>

      <div className="space-y-3">
        {comments === null && (
          <p className="text-sm text-[color:var(--text-faint)]">{t('empty')}</p>
        )}
        {comments && comments.length === 0 && (
          <p className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] py-8 text-center text-sm text-[color:var(--text-faint)]">
            {t('empty')}
          </p>
        )}
        {comments?.map((c) => {
          const isOwn = session?.user?.id === c.author.id;
          const canEdit = !readOnly && isOwn;
          const canDelete = !readOnly && (isOwn || canModerate);
          const edited = c.updatedAt !== c.createdAt;
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              className={cx(
                'rounded-xl border p-4 transition-colors',
                isOwn
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                  : 'border-[color:var(--border)] bg-[color:var(--surface)]',
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{c.author.name}</span>
                <RoleBadge role={c.author.role} />
                <FormattedDate
                  iso={c.createdAt}
                  className="text-xs text-[color:var(--text-faint)]"
                />
                {edited && (
                  <span className="text-xs italic text-[color:var(--text-faint)]">{t('edited')}</span>
                )}
                {canDelete && !isEditing && (
                  <div className="ms-auto flex items-center gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingDraft(c.body);
                        }}
                        title={t('edit')}
                        aria-label={t('edit')}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeComment(c.id)}
                      disabled={busyId === c.id}
                      title={t('delete')}
                      aria-label={t('delete')}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)] disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={editingDraft}
                    onChange={(e) => setEditingDraft(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => saveEdit(c.id)} disabled={busyId === c.id}>
                      <Check size={14} />
                      {t('save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null);
                        setEditingDraft('');
                      }}
                    >
                      <X size={14} />
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text)]">{c.body}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {readOnly ? null : session?.user ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('placeholder')}
              rows={3}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  postComment();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[color:var(--text-faint)]">
                {session.user.name || session.user.username} · {' '}
                <RoleBadge role={session.user.role} className="ms-1" />
              </span>
              <Button onClick={postComment} disabled={posting || !draft.trim()} size="sm">
                <Send size={14} />
                {posting ? t('sending') : t('send')}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[color:var(--text-faint)]">{t('loginToComment')}</p>
        )}
      </div>
    </Card>
  );
}
