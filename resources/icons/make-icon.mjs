// Generates resources/icons/icon.png (512x512) and icon.ico from the app SVG.
//
// Reads an SVG (default: ../../kvspy-icon.svg), renders it to PNGs at several
// sizes via a headless browser (Playwright, a devDependency), then writes:
//   - icon.png  (512x512, for Linux / window icon)
//   - icon.ico  (multi-size, PNG-compressed entries, for Windows)
//
// Usage:
//     node resources/icons/make-icon.mjs [path-to-svg]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const svgArg = process.argv[2];
if (!svgArg) {
  console.error('usage: node make-icon.mjs <path-to-svg>');
  process.exit(1);
}
const svgPath = resolve(svgArg);
const svgText = readFileSync(svgPath, 'utf8');

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const FULL = 512;

// Render the SVG to PNG data-URLs at every size in one browser session.
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
const pngDataUrls = await page.evaluate(
  async ({ svgText, sizes, full }) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgText);
    await img.decode();
    const out = {};
    for (const s of [...sizes, full]) {
      const c = document.createElement('canvas');
      c.width = s;
      c.height = s;
      c.getContext('2d').drawImage(img, 0, 0, s, s);
      out[s] = c.toDataURL('image/png');
    }
    return out;
  },
  { svgText, sizes: ICO_SIZES, full: FULL },
);
await browser.close();

const toBuf = (dataUrl) =>
  Buffer.from(dataUrl.split(',')[1], 'base64');

// Write the 512x512 PNG.
writeFileSync(join(here, 'icon.png'), toBuf(pngDataUrls[FULL]));

// Build a Windows .ico with PNG-compressed entries (modern Windows supports
// PNG data inside .ico). 256 is encoded as 0 per the ICO spec.
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4); // image count

  let offset = 6 + count * 16;
  const direntries = [];
  for (const { size, png } of entries) {
    const de = Buffer.alloc(16);
    de[0] = size >= 256 ? 0 : size; // width
    de[1] = size >= 256 ? 0 : size; // height
    de[2] = 0; // palette colors
    de[3] = 0; // reserved
    de.writeUInt16LE(1, 4); // color planes
    de.writeUInt16LE(32, 6); // bits per pixel
    de.writeUInt32LE(png.length, 8); // data size
    de.writeUInt32LE(offset, 12); // data offset
    offset += png.length;
    direntries.push(de);
  }
  return Buffer.concat([header, ...direntries, ...entries.map((e) => e.png)]);
}

const icoEntries = ICO_SIZES.map((size) => ({
  size,
  png: toBuf(pngDataUrls[size]),
}));
writeFileSync(join(here, 'icon.ico'), buildIco(icoEntries));

console.log(
  `Wrote resources/icons/icon.png (512x512) and icon.ico (${ICO_SIZES.join('/')}).`,
);
