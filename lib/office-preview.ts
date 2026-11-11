/** Bound Office ZIP expansion before handing untrusted files to document parsers. */
export function checkOfficeArchive(buffer: ArrayBuffer) {
  const data = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (data.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0 || data.getUint16(eocd + 4, true) !== 0 || data.getUint16(eocd + 6, true) !== 0)
    throw new Error('Invalid Office archive');
  const count = data.getUint16(eocd + 10, true);
  let offset = data.getUint32(eocd + 16, true);
  if (count > 2048 || count === 0) throw new Error('Office archive is too complex');
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || data.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Invalid Office archive');
    expanded += data.getUint32(offset + 24, true);
    if (expanded > 32 * 1024 * 1024) throw new Error('Office archive is too large to preview');
    offset +=
      46 +
      data.getUint16(offset + 28, true) +
      data.getUint16(offset + 30, true) +
      data.getUint16(offset + 32, true);
  }
  if (offset > eocd) throw new Error('Invalid Office archive');
}
