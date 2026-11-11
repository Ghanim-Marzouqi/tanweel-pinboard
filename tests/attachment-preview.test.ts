import { describe, expect, it } from 'vitest';
import { parseByteRange, previewKind } from '@/lib/attachment-preview';
import { checkOfficeArchive } from '@/lib/office-preview';

describe('private attachment previews', () => {
  it('supports exact MIME types without making active uploads executable', () => {
    expect(previewKind('image/jpeg')).toBe('image');
    expect(previewKind('video/quicktime')).toBe('video');
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('audio/mpeg')).toBe('audio');
    for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'application/octet-stream'])
      expect(previewKind(type)).toBe('unsupported');
  });
  it('serves bounded, open-ended and suffix byte ranges for seeking', () => {
    expect(parseByteRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseByteRange('bytes=40-', 100)).toEqual({ start: 40, end: 99 });
    expect(parseByteRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseByteRange('bytes=90-999', 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange('bytes=-200', 100)).toEqual({ start: 0, end: 99 });
  });
  it('rejects unsatisfiable, malformed and multipart ranges', () => {
    for (const range of [
      'bytes=100-',
      'bytes=5-4',
      'bytes=-0',
      'bytes=-',
      'bytes=a-b',
      'bytes=0-1,3-4',
      'items=0-9',
      'bytes=9007199254740993-',
    ])
      expect(parseByteRange(range, 100)).toBeNull();
    expect(parseByteRange('bytes=0-', 0)).toBeNull();
  });
  it('rejects corrupt or overexpanded Office archives before parsing', () => {
    expect(() => checkOfficeArchive(new ArrayBuffer(10))).toThrow();
    const zip = new ArrayBuffer(68),
      data = new DataView(zip);
    data.setUint32(0, 0x02014b50, true);
    data.setUint32(46, 0x06054b50, true);
    data.setUint16(56, 1, true);
    data.setUint32(24, 33 * 1024 * 1024, true);
    expect(() => checkOfficeArchive(zip)).toThrow('too large');
  });
});
