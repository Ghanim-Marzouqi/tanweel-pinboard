'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileQuestion, LoaderCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  previewKind,
  OFFICE_PREVIEW_BYTES,
  TEXT_PREVIEW_BYTES,
  type DocumentPreview,
} from '@/lib/attachment-preview';
import type { PreviewAttachment } from './attachment-preview';

const PdfPreview = dynamic(() => import('./pdf-preview'), { ssr: false });

export default function PreviewContent({ attachment, url }: { attachment: PreviewAttachment; url: string }) {
  const t = useTranslations('attachmentPreview');
  const kind = previewKind(attachment.contentType);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const media = mediaRef.current;
    return () => {
      if (media) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
    };
  }, []);
  if (kind === 'unsupported' || failed)
    return <PreviewNotice message={t(failed ? 'failed' : 'unsupported')} />;
  if (kind === 'pdf') return <PdfPreview url={url} />;
  if (kind === 'text' || kind === 'docx' || kind === 'xlsx')
    return <DocumentContent attachment={attachment} url={url} kind={kind} />;
  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-2">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <LoadingPreview />
        </div>
      )}
      {kind === 'image' ? (
        // Original protected image, never an external image optimizer/cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={attachment.fileName}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="max-h-[65dvh] max-w-full object-contain"
        />
      ) : kind === 'video' ? (
        <video
          ref={(el) => {
            mediaRef.current = el;
          }}
          src={url}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="max-h-[65dvh] w-full"
          aria-label={attachment.fileName}
        />
      ) : (
        <audio
          ref={(el) => {
            mediaRef.current = el;
          }}
          src={url}
          controls
          preload="metadata"
          onLoadedMetadata={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="w-full"
          aria-label={attachment.fileName}
        />
      )}
    </div>
  );
}

export function PreviewNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl bg-[color:var(--surface-muted)] p-6 text-center text-sm text-[color:var(--text-muted)]"
    >
      <FileQuestion size={32} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
export function LoadingPreview() {
  const t = useTranslations('attachmentPreview');
  return (
    <p
      role="status"
      className="flex min-h-24 items-center justify-center gap-2 text-sm text-[color:var(--text-muted)]"
    >
      <LoaderCircle className="animate-spin" size={18} aria-hidden />
      {t('loading')}
    </p>
  );
}

function DocumentContent({
  attachment,
  url,
  kind,
}: {
  attachment: PreviewAttachment;
  url: string;
  kind: 'text' | 'docx' | 'xlsx';
}) {
  const t = useTranslations('attachmentPreview');
  const [result, setResult] = useState<DocumentPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState(0);
  const tooLarge = kind !== 'text' && attachment.sizeBytes > OFFICE_PREVIEW_BYTES;
  useEffect(() => {
    if (tooLarge) return;
    const controller = new AbortController();
    let worker: Worker | undefined;
    let active = true;
    const timer = setTimeout(() => {
      controller.abort();
      worker?.terminate();
      if (active) setFailed(true);
    }, 20000);
    async function load() {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: kind === 'text' ? { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } : undefined,
        });
        if (!response.ok) throw new Error('Preview unavailable');
        if (kind === 'text') {
          const text = await response.text();
          if (active) setResult({ text, truncated: attachment.sizeBytes > TEXT_PREVIEW_BYTES });
          clearTimeout(timer);
        } else {
          const buffer = await response.arrayBuffer();
          if (!active || controller.signal.aborted) return;
          worker = new Worker(new URL('../workers/document-preview.worker.ts', import.meta.url));
          worker.onmessage = (event) => {
            clearTimeout(timer);
            if (active) {
              if (event.data.error) setFailed(true);
              else setResult(event.data.result);
            }
            worker?.terminate();
          };
          worker.onerror = () => {
            clearTimeout(timer);
            if (active) setFailed(true);
            worker?.terminate();
          };
          worker.postMessage({ kind, buffer }, [buffer]);
        }
      } catch {
        if (active) setFailed(true);
        clearTimeout(timer);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      worker?.terminate();
    };
  }, [url, kind, tooLarge, attachment.sizeBytes]);
  if (tooLarge) return <PreviewNotice message={t('officeLimit')} />;
  if (failed) return <PreviewNotice message={t('failed')} />;
  if (!result) return <LoadingPreview />;
  if ('text' in result)
    return (
      <>
        {kind === 'docx' && <p className="mb-3 text-xs text-[color:var(--text-muted)]">{t('wordNote')}</p>}
        {result.truncated && (
          <p role="status" className="mb-3 text-xs text-[color:var(--text-muted)]">
            {t('truncated')}
          </p>
        )}
        <pre
          dir="auto"
          className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-start font-sans text-sm leading-7"
        >
          {result.text || t('empty')}
        </pre>
      </>
    );
  const current = result.sheets[sheet];
  return (
    <>
      <p className="mb-3 text-xs text-[color:var(--text-muted)]">{t('sheetNote')}</p>
      <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {t('sheet')}
        <select
          className="max-w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
          value={sheet}
          onChange={(e) => setSheet(Number(e.target.value))}
        >
          {result.sheets.map((s, i) => (
            <option value={i} key={i}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {current?.truncated && (
        <p role="status" className="mb-3 text-xs text-[color:var(--text-muted)]">
          {t('sheetLimit')}
        </p>
      )}
      {current?.rows.length ? (
        <div
          className="max-h-[55dvh] overflow-auto rounded-xl border border-[color:var(--border)]"
          tabIndex={0}
          role="region"
          aria-label={current.name}
        >
          <table className="w-full border-collapse text-start text-sm">
            <tbody>
              {current.rows.map((row, r) => (
                <tr key={r} className="even:bg-[color:var(--surface-muted)]">
                  <th
                    scope="row"
                    className="sticky start-0 border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-2 text-xs text-[color:var(--text-faint)]"
                  >
                    {r + 1}
                  </th>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      dir="auto"
                      className="min-w-28 max-w-80 whitespace-pre-wrap break-words border border-[color:var(--border)] px-3 py-2"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PreviewNotice message={t('empty')} />
      )}
    </>
  );
}
