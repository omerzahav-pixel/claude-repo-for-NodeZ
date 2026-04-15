#!/usr/bin/env node
/**
 * Phase 2 · PWA · icon generator.
 *
 * Produces pure-Node PNG rasters of the NodeZ logo without any external
 * image library. We draw a filled square background + three connected
 * circles (two nodes + one between them) using only zlib for the IDAT
 * stream. Output lands in public/icons/.
 *
 * Sizes:
 *   - 192x192 (manifest requirement)
 *   - 512x512 (manifest requirement — used for splash)
 *   - 180x180 (Apple touch icon)
 *   - 512x512 maskable (safe-zone padded, Android adaptive icon)
 *
 * Rerun with `node scripts/gen-icons.mjs`.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// NodeZ palette.
const BG = [0x0F, 0x0F, 0x0F, 0xff];      // neutral dark (Phase 5 P1 #5 layered surfaces)
const ACCENT = [0xd9, 0x77, 0x57, 0xff];  // terracotta
const ACCENT2 = [0xc9, 0x63, 0x3f, 0xff]; // shade
const TEXT = [0xf5, 0xf0, 0xe6, 0xff];    // cream

// Alpha-blend src over dst in-place (both 4-tuple RGBA, 0-255).
function blend(dst, src) {
  const a = src[3] / 255;
  dst[0] = Math.round(src[0] * a + dst[0] * (1 - a));
  dst[1] = Math.round(src[1] * a + dst[1] * (1 - a));
  dst[2] = Math.round(src[2] * a + dst[2] * (1 - a));
  dst[3] = 255;
}

// Fill a circle with anti-aliasing.
function circle(buf, W, cx, cy, r, color) {
  const r2o = (r + 1) * (r + 1);
  const r2i = Math.max(0, (r - 1) * (r - 1));
  for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(W - 1, Math.ceil(cy + r + 1)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > r2o) continue;
      let alpha;
      if (d2 <= r2i) alpha = 1;
      else {
        const d = Math.sqrt(d2);
        alpha = Math.max(0, Math.min(1, r + 0.5 - d));
      }
      const i = (y * W + x) * 4;
      const src = [color[0], color[1], color[2], Math.round(color[3] * alpha)];
      const dst = [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
      blend(dst, src);
      buf[i] = dst[0]; buf[i + 1] = dst[1]; buf[i + 2] = dst[2]; buf[i + 3] = dst[3];
    }
  }
}

// Thick line with rounded ends — draw multiple overlapping circles along the path.
function line(buf, W, x1, y1, x2, y2, thickness, color) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    circle(buf, W, x1 + dx * t, y1 + dy * t, thickness / 2, color);
  }
}

function draw(size, { maskable = false } = {}) {
  const buf = new Uint8Array(size * size * 4);
  // Background fill.
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = BG[0]; buf[i + 1] = BG[1]; buf[i + 2] = BG[2]; buf[i + 3] = BG[3];
  }
  // Maskable needs a 40% safe-zone (adaptive icons crop outer ~20%).
  const scale = maskable ? 0.6 : 0.82;
  const pad = (size - size * scale) / 2;
  const S = size * scale;
  const T = pad;
  const r = S * 0.11;
  const lineThick = S * 0.055;
  // Three nodes in a small graph: two on the bottom, one top.
  const A = { x: T + S * 0.28, y: T + S * 0.72 };
  const B = { x: T + S * 0.72, y: T + S * 0.72 };
  const C = { x: T + S * 0.50, y: T + S * 0.28 };
  // Edges
  line(buf, size, A.x, A.y, B.x, B.y, lineThick, TEXT);
  line(buf, size, A.x, A.y, C.x, C.y, lineThick, TEXT);
  line(buf, size, C.x, C.y, B.x, B.y, lineThick, TEXT);
  // Nodes — drop shadow then fill.
  for (const p of [A, B, C]) {
    circle(buf, size, p.x + S * 0.012, p.y + S * 0.02, r * 1.05, [0, 0, 0, 120]);
  }
  circle(buf, size, A.x, A.y, r, ACCENT);
  circle(buf, size, B.x, B.y, r, ACCENT2);
  circle(buf, size, C.x, C.y, r, ACCENT);
  // Inner highlight
  for (const p of [A, B, C]) {
    circle(buf, size, p.x - r * 0.3, p.y - r * 0.3, r * 0.3, [255, 255, 255, 60]);
  }
  return buf;
}

// Minimal PNG encoder — writes an RGBA 8-bit image with a single IDAT.
function crc32(data) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcInput = Buffer.concat([typeBuf, Buffer.from(data)]);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, Buffer.from(data), crcBuf]);
}

function encodePNG(rgba, W, H) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // color type RGBA
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace
  // PNG scanlines with filter byte 0 at start of each row.
  const scan = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    scan[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W * 4; x++) scan[y * (W * 4 + 1) + 1 + x] = rgba[y * W * 4 + x];
  }
  const idat = deflateSync(scan);
  const iend = Buffer.alloc(0);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

for (const size of [192, 512, 180]) {
  const rgba = draw(size);
  const png = encodePNG(rgba, size, size);
  const path = resolve(OUT, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}
for (const size of [512]) {
  const rgba = draw(size, { maskable: true });
  const png = encodePNG(rgba, size, size);
  const path = resolve(OUT, `icon-${size}-maskable.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}
