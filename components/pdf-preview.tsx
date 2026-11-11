'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { PDFJS_ASSETS } from '@/lib/pdfjs-assets';
import { Button } from '@/components/ui/button';
import { LoadingPreview, PreviewNotice } from './attachment-preview-content';

export default function PdfPreview({ url }: { url: string }) {
  const t = useTranslations('attachmentPreview');
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(280);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [pageText, setPageText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | undefined;
    void import('pdfjs-dist')
      .then((pdfjs) => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSETS}pdf.worker.min.mjs`;
        task = pdfjs.getDocument({
          url,
          cMapUrl: `${PDFJS_ASSETS}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${PDFJS_ASSETS}standard_fonts/`,
          wasmUrl: `${PDFJS_ASSETS}wasm/`,
          disableAutoFetch: true,
          disableStream: true,
          maxImageSize: 16_000_000,
        });
        return task.promise.then((pdf) => {
          if (!cancelled) setDocument(pdf);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(100, entries[0].contentRect.width - 16)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    async function paint() {
      try {
        const pdfPage = await document!.getPage(page);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        setBusy(true);
        const natural = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(width / natural.width, 1.6) * zoom;
        const viewport = pdfPage.getViewport({ scale });
        // Bound raster memory, including PDFs with extreme page dimensions.
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(8_000_000 / (viewport.width * viewport.height)),
        );
        canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
        canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        render = pdfPage.render({
          canvas,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
          annotationMode: 0,
        });
        await render.promise;
        const content = await pdfPage.getTextContent();
        if (!cancelled) {
          setPageText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
          setBusy(false);
        }
      } catch (e) {
        if (!cancelled && (e as Error).name !== 'RenderingCancelledException') setFailed(true);
      }
    }
    void paint();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page, zoom, width]);
  if (failed) return <PreviewNotice message={t('failed')} />;
  return (
    <div>
      {document && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2" dir="ltr">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label={t('previousPage')}
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="text-sm" role="status">
            {t('pageOf', { page, total: document.numPages })}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= document.numPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label={t('nextPage')}
          >
            <ChevronRight size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => z - 0.25)}
            aria-label={t('zoomOut')}
          >
            <Minus size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => z + 0.25)}
            aria-label={t('zoomIn')}
          >
            <Plus size={16} />
          </Button>
        </div>
      )}
      {busy && <LoadingPreview />}
      <div
        ref={containerRef}
        className="max-h-[65dvh] overflow-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-2"
        tabIndex={0}
        role="region"
        aria-label={t('pdfPage')}
      >
        <canvas ref={canvasRef} aria-label={t('pdfPage')} className="mx-auto bg-white" />
        <p className="sr-only">{pageText}</p>
      </div>
    </div>
  );
}
