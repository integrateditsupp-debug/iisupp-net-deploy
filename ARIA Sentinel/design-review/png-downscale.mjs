// Dependency-free PNG box-average downscaler (RUN 16 icon generation). Decodes a 32-bit RGBA PNG,
// area-averages it down to a target square, and re-encodes. zlib only (node:zlib). Not general-purpose
// — handles the 8-bit RGBA, non-interlaced, single-IDAT-ish output that headless Chrome produces.
import fs from "node:fs";
import zlib from "node:zlib";

export function readPng(buf) {
  let p = 8; // skip signature
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`unsupported PNG (bitDepth ${bitDepth}, colorType ${colorType})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0;
      const b = prev[x];
      const c = x >= 4 ? prev[x - 4] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, rgba: out };
}

export function downscale(src, n) {
  const { w, h, rgba } = src;
  const out = Buffer.alloc(n * n * 4);
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const x0 = Math.floor((tx * w) / n), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / n));
      const y0 = Math.floor((ty * h) / n), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / n));
      let r = 0, g = 0, b = 0, a = 0, cnt = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4; const al = rgba[i + 3];
        r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; cnt++;
      }
      const o = (ty * n + tx) * 4;
      out[o] = a ? Math.round(r / a) : 0; out[o + 1] = a ? Math.round(g / a) : 0; out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / cnt);
    }
  }
  return { w: n, h: n, rgba: out };
}

export function writePng({ w, h, rgba }) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) { CRC_TABLE = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// CLI: only run when invoked directly (so the module can be imported + unit-tested).
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("png-downscale.mjs")) {
  const [, , masterPath, ...sizes] = process.argv;
  const master = readPng(fs.readFileSync(masterPath));
  for (const s of sizes) {
    const n = Number(s);
    fs.writeFileSync(`.tmp-icons/i-${n}.png`, writePng(downscale(master, n)));
    console.log(`wrote i-${n}.png (${n}x${n})`);
  }
}
