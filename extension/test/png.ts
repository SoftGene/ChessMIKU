import { inflateSync } from 'node:zlib';

// Reads the PNGs the icon script writes: 8-bit RGBA, not interlaced. Enough to check sizes and margins
// without an image library.
export interface Png {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodePng(bytes: Uint8Array): Png {
  if (!SIGNATURE.every((byte, i) => bytes[i] === byte)) throw new Error('not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  const data: Uint8Array[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(at + 8);
      height = view.getUint32(at + 12);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || colour !== 6 || interlace !== 0) {
        throw new Error(`expected 8-bit RGBA without interlace, got depth ${depth}, colour type ${colour}, interlace ${interlace}`);
      }
    }
    if (type === 'IDAT') data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? rgba[(y - 1) * stride + x - 4] : 0;
      rgba[y * stride + x] = (line[x] + predict(filter, left, up, upLeft)) & 0xff;
    }
  }
  return { width, height, rgba };
}

function predict(filter: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0: return 0;
    case 1: return left;
    case 2: return up;
    case 3: return (left + up) >> 1;
    case 4: {
      const p = left + up - upLeft;
      const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
      return a <= b && a <= c ? left : b <= c ? up : upLeft;
    }
    default: throw new Error(`unknown PNG filter ${filter}`);
  }
}

// The box around the pixels at least this opaque; right and bottom are exclusive.
export function opaqueBox(png: Png, minAlpha: number) {
  let [left, top, right, bottom] = [png.width, png.height, 0, 0];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (png.rgba[(y * png.width + x) * 4 + 3] >= minAlpha) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
  }
  return { left, top, right, bottom };
}
