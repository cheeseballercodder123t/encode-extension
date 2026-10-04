const fs = require('fs');
const zlib = require('zlib');

function createPng(width, height, colorR, colorG, colorB) {
  // Simple uncompressed RGBA PNG generator
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    let crc = 0xffffffff;
    const crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[i] = c;
    }
    for (let i = 4; i < 8 + len; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw pixel data: each scanline starts with filter byte (0)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = (width / 2) - 1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Gold icon body on dark background
        if (dist > r - (width > 32 ? 2 : 1)) {
          // Gold border (#f59e0b)
          rawData[pxOffset] = 245;
          rawData[pxOffset + 1] = 158;
          rawData[pxOffset + 2] = 11;
          rawData[pxOffset + 3] = 255;
        } else {
          // Inside: dark background (#0f111a) with stylized gold 'E'\n          const nx = (x - (cx - r * 0.5)) / (r * 1.0);
          const ny = (y - (cy - r * 0.6)) / (r * 1.2);
          
          let isE = false;
          // Vertical spine of E
          if (nx >= 0.15 && nx <= 0.35 && ny >= 0.1 && ny <= 0.9) isE = true;
          // Top bar
          if (nx >= 0.15 && nx <= 0.85 && ny >= 0.1 && ny <= 0.28) isE = true;
          // Middle bar
          if (nx >= 0.15 && nx <= 0.65 && ny >= 0.42 && ny <= 0.58) isE = true;
          // Bottom bar
          if (nx >= 0.15 && nx <= 0.85 && ny >= 0.72 && ny <= 0.9) isE = true;

          if (isE) {
            rawData[pxOffset] = 245;     // Gold
            rawData[pxOffset + 1] = 158;
            rawData[pxOffset + 2] = 11;
            rawData[pxOffset + 3] = 255;
          } else {
            rawData[pxOffset] = 15;      // Dark slate #0f111a
            rawData[pxOffset + 1] = 17;
            rawData[pxOffset + 2] = 26;
            rawData[pxOffset + 3] = 255;
          }
        }
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

[16, 32, 48, 128].forEach(size => {
  const png = createPng(size, size);
  fs.writeFileSync(`icons/icon-${size}.png`, png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
});
