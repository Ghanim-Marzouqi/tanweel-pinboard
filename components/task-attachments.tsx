'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Paperclip, Upload, X, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { formatBytes, cx } from '@/lib/utils';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/validation';
import type { ExistingAttachment } from '@/components/task-form';

interface Props {
  mode: 'create' | 'edit';
  taskId?: string;
  existing: ExistingAttachment[];
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
}

const ALLOWED = ALLOWED_UPLOAD_TYPES;
const MAX = MAX_UPLOAD_BYTES;

export function TaskAttachments({ mode, taskId, existing, pendingFiles, onPendingChange }: Props) {
  const t = useTranslations('tasks.attachments');
  const tFields = useTranslations('tasks.fields');
  const tConfirm = useTranslations('confirm.removeAttachment');
  const tCommon = useTranslations('common');
  const tToast = useTranslations('toast');
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  function validateFile(f: File): string | null {
    if (f.size > MAX) return `${f.name}: too large (max 10 MB)`;
    if (!ALLOWED.includes(f.type as (typeof ALLOWED)[number])) return `${f.name}: unsupported type`;
    return null;
  }

  async function uploadOne(file: File) {
    if (!taskId) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const errors = list.map(validateFile).filter(Boolean) as string[];
    if (errors.length) {
      toast.error(tToast('attachmentUploadFailed'), { description: errors.join('\n') });
      return;
    }
    if (mode === 'create') {
      onPendingChange([...pendingFiles, ...list]);
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        await uploadOne(file);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(tToast('attachmentUploadFailed'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveExisting(attachmentId: string) {
    if (!taskId) return;
    const ok = await confirm({
      title: tConfirm('title'),
      description: tConfirm('description'),
      confirmLabel: tCommon('remove'),
      tone: 'danger',
    });
    if (!ok) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Remove failed');
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(tToast('attachmentRemoveFailed'), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePending(idx: number) {
    onPendingChange(pendingFiles.filter((_, i) => i !== idx));
  }

  const allItems = [
    ...existing.map((a) => ({ kind: 'existing' as const, attachment: a })),
    ...pendingFiles.map((f, idx) => ({ kind: 'pending' as const, file: f, idx })),
  ];

  return (
    <div>
      <Label className="mb-1.5">{tFields('attachments')}</Label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-center transition-colors',
          isDragging
            ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
            : 'border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] hover:bg-[color:var(--surface)]',
        )}
      >
        <Upload size={20} className="text-[color:var(--text-faint)]" />
        <p className="text-sm font-medium text-[color:var(--text)]">{t('drop')}</p>
        <p className="text-xs text-[color:var(--text-faint)]">{t('hint')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {allItems.length > 0 && (
        <div className="mt-3 space-y-2">
          {allItems.map((item) =>
            item.kind === 'existing' ? (
              <ExistingAttachmentRow
                key={item.attachment.id}
                attachment={item.attachment}
                taskId={taskId!}
                onRemove={() => handleRemoveExisting(item.attachment.id)}
                disabled={uploading}
              />
            ) : (
              <PendingAttachmentRow
                key={`pending-${item.idx}`}
                file={item.file}
                onRemove={() => handleRemovePending(item.idx)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ExistingAttachmentRow({
  attachment,
  taskId,
  onRemove,
  disabled,
}: {
  attachment: ExistingAttachment;
  taskId: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  const t = useTranslations('tasks.attachments');
  const isImage = attachment.contentType.startsWith('image/');
  const Icon = isImage ? ImageIcon : FileText;
  const downloadUrl = `/api/tasks/${taskId}/attachments/${attachment.id}/download`;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <Icon size={18} className="text-[color:var(--accent)] shrink-0" />
      <div className="min-w-0 flex-1">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-[color:var(--text)] hover:text-[color:var(--accent)]"
        >
          {attachment.fileName}
        </a>
        <div className="text-xs text-[color:var(--text-faint)]">{formatBytes(attachment.sizeBytes)}</div>
      </div>
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass({ variant: 'secondary', size: 'sm' })}
      >
        {t('open')}
      </a>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title={t('remove')}
        aria-label={t('remove')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger)] disabled:opacity-40"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function PendingAttachmentRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 py-2">
      <Paperclip size={18} className="text-[color:var(--accent)] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[color:var(--text)]">{file.name}</div>
        <div className="text-xs text-[color:var(--text-faint)]">{formatBytes(file.size)}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
