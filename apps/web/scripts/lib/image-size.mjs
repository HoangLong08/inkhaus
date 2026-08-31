/**
 * Pixel dimensions straight out of an image file header.
 *
 * Deliberately not `sharp` or `image-size`: the only thing this repo needs from
 * an image library is two integers, and `sharp` is a native dependency that
 * would have to build on every machine and every CI runner to serve them.
 * JPEG/PNG/WebP headers are a few dozen bytes of well-documented layout.
 */

/** @returns {{w:number,h:number,type:string}|null} */
export function imageSize(buf) {
  return png(buf) ?? jpeg(buf) ?? webp(buf) ?? gif(buf) ?? null;
}

function png(b) {
  // 89 50 4E 47 0D 0A 1A 0A, then an IHDR chunk whose data starts at byte 16
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: "png" };
}

function jpeg(b) {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;

  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) {
      i++; // resync: padding between segments is legal
      continue;
    }
    const marker = b[i + 1];

    // standalone markers carry no length
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // SOS - entropy-coded data follows and there is no frame header after it
    if (marker === 0xda) return null;

    const len = b.readUInt16BE(i + 2);
    // SOFn: every frame marker except DHT(c4), JPG(c8) and DAC(cc)
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      // ...FF Cn LLLL PP HHHH WWWW - height precedes width
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: "jpg" };
    }
    if (len < 2) return null; // malformed; bail rather than loop forever
    i += 2 + len;
  }
  return null;
}

function webp(b) {
  if (b.length < 30) return null;
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;

  const fourcc = b.toString("ascii", 12, 16);
  if (fourcc === "VP8X") {
    // 24-bit little-endian, stored as (value - 1)
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { w, h, type: "webp" };
  }
  if (fourcc === "VP8 ") {
    // lossy: 14 bits each, after the 3-byte start code 9D 01 2A
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, type: "webp" };
  }
  if (fourcc === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff), type: "webp" };
  }
  return null;
}

function gif(b) {
  if (b.length < 10 || b.toString("ascii", 0, 3) !== "GIF") return null;
  return { w: b.readUInt16LE(6), h: b.readUInt16LE(8), type: "gif" };
}
