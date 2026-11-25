// Generates ARAN PWA icons (PNG) without external deps. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };

function png(size, { maskable }) {
  const ORANGE = [0xe8, 0x75, 0x35], CREAM = [0xf7, 0xf2, 0xe9];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const s = size, pad = maskable ? 0 : s * 0.0, r = maskable ? 0 : s * 0.22;
  const scale = maskable ? 0.5 : 0.62; // glyph size (maskable keeps the safe zone)
  const gw = s * scale, gx = (s - gw) / 2, gy = s / 2 - gw * 0.5, th = gw * 0.16;
  const ax = gx + gw / 2, top = gy, bot = gy + gw;
  const seg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); };
  for (let y = 0; y < s; y++) {
    raw[y * (s * 4 + 1)] = 0;
    for (let x = 0; x < s; x++) {
      const dx = Math.max(r - x, 0, x - (s - 1 - r)), dy = Math.max(r - y, 0, y - (s - 1 - r));
      const inside = Math.hypot(dx, dy) <= r + 0.5 || maskable;
      const glyph = Math.min(seg(x, y, ax, top, gx, bot), seg(x, y, ax, top, gx + gw, bot), seg(x, y, gx + gw * 0.22, gy + gw * 0.68, gx + gw * 0.78, gy + gw * 0.68)) < th / 2;
      const col = glyph ? CREAM : ORANGE;
      const o = y * (s * 4 + 1) + 1 + x * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, {}));
writeFileSync('public/icons/icon-512.png', png(512, {}));
writeFileSync('public/icons/icon-maskable-512.png', png(512, { maskable: true }));
writeFileSync('public/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#E87535"/><path d="M32 14 16 50M32 14l16 36M22 38h20" stroke="#F7F2E9" stroke-width="6" stroke-linecap="round" fill="none"/></svg>`);
console.log('icons written');
