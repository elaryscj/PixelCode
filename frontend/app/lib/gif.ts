// app/lib/gif.ts — a small animated-GIF encoder (GIF89a, LZW) for pixel art: few colors, transparent background.
// Used by the skin editor to download an animation. Frames are RGBA pixels of the same size.

/** Builds an animated, looping GIF. Pixels with alpha < 128 become transparent. */
export function encodeGif(frames: Uint8ClampedArray[], width: number, height: number, delayMs: number): Uint8Array<ArrayBuffer> {
  // 1. palette: index 0 is transparent, then every color used (pixel art has few; extra ones are rounded)
  const colors = new Map<number, number>();
  let shift = 0;
  const keyOf = (r: number, g: number, b: number) => (((r >> shift) << 16) | ((g >> shift) << 8) | (b >> shift)) >>> 0;
  for (;;) {
    colors.clear();
    for (const f of frames) {
      for (let i = 0; i < f.length; i += 4) {
        if (f[i + 3] < 128) continue;
        const k = keyOf(f[i], f[i + 1], f[i + 2]);
        if (!colors.has(k)) colors.set(k, colors.size + 1);
      }
    }
    if (colors.size <= 255 || shift >= 4) break;
    shift++;
  }
  let bits = 1;
  while (1 << bits < colors.size + 1) bits++;
  const tableSize = 1 << bits;

  const out: number[] = [];
  const u16 = (v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  const str = (s: string) => {
    for (const c of s) out.push(c.charCodeAt(0));
  };

  str("GIF89a");
  u16(width);
  u16(height);
  out.push(0x80 | 0x70 | (bits - 1), 0, 0); // global color table, 8-bit color resolution
  const table = new Array(tableSize * 3).fill(0);
  for (const [k, idx] of colors) {
    table[idx * 3] = Math.min(255, ((k >> 16) & 0xff) << shift);
    table[idx * 3 + 1] = Math.min(255, ((k >> 8) & 0xff) << shift);
    table[idx * 3 + 2] = Math.min(255, (k & 0xff) << shift);
  }
  out.push(...table);
  // loop forever
  out.push(0x21, 0xff, 0x0b);
  str("NETSCAPE2.0");
  out.push(0x03, 0x01, 0x00, 0x00, 0x00);

  const delay = Math.max(2, Math.round(delayMs / 10));
  const minCode = Math.max(2, bits);
  for (const f of frames) {
    out.push(0x21, 0xf9, 0x04, (2 << 2) | 1); // restore to background, transparent index given
    u16(delay);
    out.push(0, 0);
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(width);
    u16(height);
    out.push(0);
    const indices = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
      indices[p] = f[i + 3] < 128 ? 0 : colors.get(keyOf(f[i], f[i + 1], f[i + 2]))!;
    }
    out.push(minCode);
    const data = lzw(indices, minCode);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.subarray(i, i + 255);
      out.push(chunk.length, ...chunk);
    }
    out.push(0);
  }
  out.push(0x3b);
  return new Uint8Array(out);
}

/** GIF-flavoured LZW with variable code size, LSB-first bit packing. */
function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let next = eoi + 1;
  let table = new Map<number, number>();
  const bytes: number[] = [];
  let acc = 0;
  let accBits = 0;
  const emit = (code: number) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      bytes.push(acc & 0xff);
      acc >>>= 8;
      accBits -= 8;
    }
  };

  emit(clear);
  let cur = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (cur << 8) | k;
    const found = table.get(key);
    if (found !== undefined) {
      cur = found;
      continue;
    }
    emit(cur);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      next = eoi + 1;
      codeSize = minCode + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    cur = k;
  }
  emit(cur);
  emit(eoi);
  if (accBits > 0) bytes.push(acc & 0xff);
  return new Uint8Array(bytes);
}
