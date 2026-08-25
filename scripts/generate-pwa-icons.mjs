import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, size, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = 255;
}

function fillCircle(rgba, size, cx, cy, radius, color) {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) setPixel(rgba, size, x, y, ...color);
    }
  }
}

function fillRoundRect(rgba, size, x0, y0, w, h, radius, color) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  for (let y = Math.floor(y0); y < y1; y++) {
    for (let x = Math.floor(x0); x < x1; x++) {
      const dx = x + 0.5 < x0 + radius ? x0 + radius - (x + 0.5) : x + 0.5 > x1 - radius ? x + 0.5 - (x1 - radius) : 0;
      const dy = y + 0.5 < y0 + radius ? y0 + radius - (y + 0.5) : y + 0.5 > y1 - radius ? y + 0.5 - (y1 - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius || (dx === 0 || dy === 0)) {
        if (x >= 0 && y >= 0 && x < size && y < size) setPixel(rgba, size, x, y, ...color);
      }
    }
  }
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4, 255);
  const bg = [9, 9, 11];
  const white = [255, 255, 255];
  const gold = [16, 185, 129];
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = 255;
  }

  const cardX = size * 0.22;
  const cardY = size * 0.28;
  fillRoundRect(rgba, size, cardX, cardY, size * 0.56, size * 0.44, size * 0.06, white);
  fillRoundRect(rgba, size, cardX, cardY, size * 0.56, size * 0.1, size * 0.06, [16, 185, 129]);
  fillCircle(rgba, size, size * 0.62, size * 0.62, size * 0.16, gold);
  fillCircle(rgba, size, size * 0.62, size * 0.62, size * 0.11, white);
  fillRoundRect(rgba, size, size * 0.3, size * 0.52, size * 0.07, size * 0.12, size * 0.015, bg);
  fillRoundRect(rgba, size, size * 0.4, size * 0.46, size * 0.07, size * 0.18, size * 0.015, bg);
  fillRoundRect(rgba, size, size * 0.5, size * 0.5, size * 0.07, size * 0.14, size * 0.015, bg);

  return encodePNG(size, size, rgba);
}

function writePng(file, buffer) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
}

writePng("public/icons/icon-192.png", drawIcon(192));
writePng("public/icons/icon-512.png", drawIcon(512));
writePng("public/icon-192.png", drawIcon(192));
writePng("public/icon-512.png", drawIcon(512));
writePng("public/apple-touch-icon.png", drawIcon(180));
console.log("ícones PWA gerados");
