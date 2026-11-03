// 產生主畫面圖示（原創小車）。執行：npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZES = [180, 192, 512];
const SUPERSAMPLE = 4;

const COLORS = {
  background: [46, 139, 110],
  road: [36, 112, 89],
  body: [245, 166, 35],
  window: [205, 235, 245],
  wheel: [43, 43, 43],
  hub: [221, 221, 221],
  light: [255, 246, 200],
};

const roundedRect = (x0, y0, x1, y1, r) => (x, y) => {
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && dx * dx + dy * dy <= r * r;
};
const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// 由下往上疊；座標為 0～1
const LAYERS = [
  [roundedRect(0.1, 0.73, 0.9, 0.78, 0.02), COLORS.road],
  [roundedRect(0.3, 0.33, 0.68, 0.53, 0.07), COLORS.body],
  [roundedRect(0.16, 0.47, 0.84, 0.67, 0.07), COLORS.body],
  [roundedRect(0.34, 0.37, 0.48, 0.48, 0.03), COLORS.window],
  [roundedRect(0.51, 0.37, 0.64, 0.48, 0.03), COLORS.window],
  [circle(0.33, 0.67, 0.08), COLORS.wheel],
  [circle(0.67, 0.67, 0.08), COLORS.wheel],
  [circle(0.33, 0.67, 0.03), COLORS.hub],
  [circle(0.67, 0.67, 0.03), COLORS.hub],
  [circle(0.8, 0.54, 0.025), COLORS.light],
];

function colorAt(x, y) {
  const hit = [...LAYERS].reverse().find(([shape]) => shape(x, y));
  return hit ? hit[1] : COLORS.background;
}

function renderPixels(size) {
  const rows = [];
  for (let py = 0; py < size; py += 1) {
    const row = Buffer.alloc(1 + size * 4); // 每列開頭 1 byte 為濾波類型 0
    for (let px = 0; px < size; px += 1) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const c = colorAt((px + (sx + 0.5) / SUPERSAMPLE) / size, (py + (sy + 0.5) / SUPERSAMPLE) / size);
          c.forEach((v, i) => { sum[i] += v; });
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE;
      sum.forEach((v, i) => { row[1 + px * 4 + i] = Math.round(v / n); });
      row[1 + px * 4 + 3] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(renderPixels(size))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of SIZES) {
  const file = new URL(`../icons/icon-${size}.png`, import.meta.url);
  writeFileSync(file, encodePng(size));
  console.log(`icons/icon-${size}.png`);
}
