import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dest = `public/preview/pdfjs-${version}`;
await mkdir(dest, { recursive: true });
await cp(path.join(root, 'build/pdf.worker.min.mjs'), `${dest}/pdf.worker.min.mjs`);
for (const name of ['cmaps', 'standard_fonts', 'wasm'])
  await cp(path.join(root, name), `${dest}/${name}`, { recursive: true });
