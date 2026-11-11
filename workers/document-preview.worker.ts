import {
  OFFICE_PREVIEW_BYTES,
  PREVIEW_COLUMNS,
  PREVIEW_ROWS,
  TEXT_PREVIEW_BYTES,
  type DocumentPreview,
} from '@/lib/attachment-preview';
import { checkOfficeArchive } from '@/lib/office-preview';

// Dedicated, terminable worker: parsers never block the page or insert uploaded HTML.
self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; kind: 'docx' | 'xlsx' }>) => {
  try {
    const { buffer, kind } = event.data;
    if (buffer.byteLength > OFFICE_PREVIEW_BYTES) throw new Error('Too large');
    checkOfficeArchive(buffer);
    let result: DocumentPreview;
    if (kind === 'docx') {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
      result = { text: value.slice(0, TEXT_PREVIEW_BYTES), truncated: value.length > TEXT_PREVIEW_BYTES };
    } else {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer, {
        ignoreNodes: ['drawing', 'picture', 'extLst', 'conditionalFormatting'],
      });
      result = {
        sheets: workbook.worksheets.slice(0, 30).map((sheet) => ({
          name: sheet.name,
          truncated:
            sheet.rowCount > PREVIEW_ROWS ||
            sheet.columnCount > PREVIEW_COLUMNS ||
            workbook.worksheets.length > 30,
          rows: Array.from({ length: Math.min(sheet.rowCount, PREVIEW_ROWS) }, (_, r) =>
            Array.from({ length: Math.min(sheet.columnCount, PREVIEW_COLUMNS) }, (_, c) =>
              // Display values only; no formula evaluation, images, links or HTML.
              sheet
                .getRow(r + 1)
                .getCell(c + 1)
                .text.slice(0, 2000),
            ),
          ),
        })),
      };
    }
    self.postMessage({ result });
  } catch {
    self.postMessage({ error: true });
  }
};
