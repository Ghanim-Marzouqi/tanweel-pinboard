'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Download, Eye, FileText, Film, Image as ImageIcon, Music } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { buttonClass } from '@/components/ui/button';
import { previewKind } from '@/lib/attachment-preview';
import { formatBytes } from '@/lib/utils';

const PreviewContent = dynamic(() => import('./attachment-preview-content'));
export interface PreviewAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export function AttachmentPreview({
  attachment,
  baseUrl,
}: {
  attachment: PreviewAttachment;
  baseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('attachmentPreview');
  const kind = previewKind(attachment.contentType);
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Film : kind === 'audio' ? Music : FileText;
  const downloadUrl = `${baseUrl}/${attachment.id}/download`;
  return (
    <>
      <a
        href={downloadUrl}
        aria-label={attachment.fileName}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-start focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
      >
        <Icon size={20} aria-hidden className="shrink-0 text-[color:var(--accent)]" />
        <span className="min-w-0 flex-1">
          <bdi className="block truncate text-sm font-medium text-[color:var(--text)] group-hover:text-[color:var(--accent)]">
            {attachment.fileName}
          </bdi>
          <bdi dir="ltr" className="block text-xs text-[color:var(--text-muted)]">
            {formatBytes(attachment.sizeBytes)}
          </bdi>
        </span>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs text-[color:var(--accent)]">
          <Eye size={18} aria-hidden />
          <span className="hidden sm:inline">{t('preview')}</span>
        </span>
      </a>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={attachment.fileName}
        className="attachment-preview-dialog"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[color:var(--text-muted)]">
            {t('private')} · <bdi dir="ltr">{formatBytes(attachment.sizeBytes)}</bdi>
          </p>
          <a href={downloadUrl} download className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            <Download size={16} aria-hidden />
            {t('download')}
          </a>
        </div>
        {open && (
          <PreviewContent key={attachment.id} attachment={attachment} url={`${downloadUrl}?preview=1`} />
        )}
      </Dialog>
    </>
  );
}
