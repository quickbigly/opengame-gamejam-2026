// Reads Playwright screenshots (8-bit RGB/RGBA PNG) into pixels, for colour and presence checks.
import { inflateSync } from "node:zlib";

export function decodePng(buffer) {
  let pos = 8, width = 0, height = 0, type = 0;
  const data = [];
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const kind = buffer.toString("ascii", pos + 4, pos + 8);
    const body = buffer.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error("only 8-bit, non-interlaced PNGs");
      type = body[9];
    } else if (kind === "IDAT") data.push(body);
    else if (kind === "IEND") break;
    pos += 12 + len;
  }
  const bpp = { 2: 3, 6: 4 }[type];
  if (!bpp) throw new Error(`unsupported PNG colour type ${type}`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2]; out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

export function pixel(img, x, y) {
  const o = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

/** Mean colour of a square of side 2r+1 around (x, y). */
export function mean(img, x, y, r = 2) {
  const sum = [0, 0, 0]; let n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const p = pixel(img, x + dx, y + dy); sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
  }
  return sum.map(v => v / n);
}

/** Pixels in a rectangle within `tol` (per channel) of a colour. */
export function count(img, [x0, y0, w, h], rgb, tol = 40) {
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) {
      const p = pixel(img, x, y);
      if (Math.abs(p[0] - rgb[0]) <= tol && Math.abs(p[1] - rgb[1]) <= tol && Math.abs(p[2] - rgb[2]) <= tol) n++;
    }
  return n;
}

/** Pixels in a rectangle for which fn([r, g, b]) is true. */
export function countWhere(img, [x0, y0, w, h], fn) {
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) if (fn(pixel(img, x, y))) n++;
  return n;
}

/** Relative luminance (0..1) and the WCAG contrast ratio between two colours. */
export function luminance([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Plain RGB distance, 0..441. */
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const hex = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
