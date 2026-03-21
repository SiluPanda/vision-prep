/**
 * Helpers to generate minimal valid image buffers for testing.
 * All images are generated programmatically — no external files needed.
 */

/**
 * Create a minimal valid PNG buffer with given dimensions.
 * PNG format:
 *   8-byte signature
 *   IHDR chunk: 4 bytes length (13) + 4 bytes "IHDR" + 4 bytes width + 4 bytes height + 5 bytes (depth, color, etc.) + 4 bytes CRC
 *   IEND chunk: 4 bytes length (0) + 4 bytes "IEND" + 4 bytes CRC
 */
export function createMinimalPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(58);

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4E;
  buf[3] = 0x47;
  buf[4] = 0x0D;
  buf[5] = 0x0A;
  buf[6] = 0x1A;
  buf[7] = 0x0A;

  // IHDR chunk length: 13 (0x0000000D)
  buf.writeUInt32BE(13, 8);

  // IHDR chunk type
  buf[12] = 0x49; // I
  buf[13] = 0x48; // H
  buf[14] = 0x44; // D
  buf[15] = 0x52; // R

  // Width and Height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);

  // Bit depth: 8
  buf[24] = 8;
  // Color type: 2 (RGB)
  buf[25] = 2;
  // Compression: 0
  buf[26] = 0;
  // Filter: 0
  buf[27] = 0;
  // Interlace: 0
  buf[28] = 0;

  // CRC for IHDR (placeholder — not validated by our code)
  buf.writeUInt32BE(0x00000000, 29);

  // IDAT chunk (minimal — 1 byte of data)
  buf.writeUInt32BE(1, 33);
  buf[37] = 0x49; // I
  buf[38] = 0x44; // D
  buf[39] = 0x41; // A
  buf[40] = 0x54; // T
  buf[41] = 0x00;
  buf.writeUInt32BE(0x00000000, 42);

  // IEND chunk
  buf.writeUInt32BE(0, 46);
  buf[50] = 0x49; // I
  buf[51] = 0x45; // E
  buf[52] = 0x4E; // N
  buf[53] = 0x44; // D

  // CRC for IEND
  buf.writeUInt32BE(0xAE426082, 54);

  return buf;
}

/**
 * Create a minimal valid JPEG buffer with given dimensions.
 * JPEG format:
 *   SOI (FF D8)
 *   APP0 JFIF marker (optional, we include it for realism)
 *   SOF0 (FF C0) with dimensions
 *   EOI (FF D9)
 */
export function createMinimalJpeg(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);

  // SOI marker
  buf[0] = 0xFF;
  buf[1] = 0xD8;

  // APP0 marker (minimal)
  buf[2] = 0xFF;
  buf[3] = 0xE0;
  buf.writeUInt16BE(16, 4); // Length
  // JFIF\0
  buf[6] = 0x4A;
  buf[7] = 0x46;
  buf[8] = 0x49;
  buf[9] = 0x46;
  buf[10] = 0x00;
  // Version
  buf[11] = 0x01;
  buf[12] = 0x01;
  // Rest zeros (density, etc.)

  // SOF0 marker (Start of Frame - baseline DCT)
  buf[20] = 0xFF;
  buf[21] = 0xC0;
  buf.writeUInt16BE(8, 22); // Length (8 bytes for SOF header with 0 components)
  buf[24] = 8; // Precision
  buf.writeUInt16BE(height, 25); // Height
  buf.writeUInt16BE(width, 27); // Width
  buf[29] = 0; // Number of components (0 for this minimal buffer)

  return buf;
}

/**
 * Create a minimal valid GIF buffer with given dimensions.
 * GIF format:
 *   6-byte signature ("GIF89a")
 *   2-byte width (LE)
 *   2-byte height (LE)
 *   + minimal global color table and terminator
 */
export function createMinimalGif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(14);

  // GIF89a signature
  buf[0] = 0x47; // G
  buf[1] = 0x49; // I
  buf[2] = 0x46; // F
  buf[3] = 0x38; // 8
  buf[4] = 0x39; // 9
  buf[5] = 0x61; // a

  // Width (little-endian)
  buf.writeUInt16LE(width, 6);
  // Height (little-endian)
  buf.writeUInt16LE(height, 8);

  // Packed byte: no global color table
  buf[10] = 0x00;
  // Background color index
  buf[11] = 0x00;
  // Pixel aspect ratio
  buf[12] = 0x00;
  // Trailer
  buf[13] = 0x3B;

  return buf;
}

/**
 * Create a minimal valid WebP buffer with given dimensions (VP8 lossy).
 * WebP VP8:
 *   RIFF header (12 bytes)
 *   VP8 chunk header (8 bytes)
 *   VP8 bitstream: frame tag (3 bytes), start code (3 bytes: 9D 01 2A), width (2 LE), height (2 LE)
 */
export function createMinimalWebpVP8(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);

  // RIFF header
  buf[0] = 0x52; // R
  buf[1] = 0x49; // I
  buf[2] = 0x46; // F
  buf[3] = 0x46; // F

  // File size - 8 (RIFF chunk size)
  buf.writeUInt32LE(buf.length - 8, 4);

  // WEBP
  buf[8] = 0x57;  // W
  buf[9] = 0x45;  // E
  buf[10] = 0x42; // B
  buf[11] = 0x50; // P

  // VP8 chunk
  buf[12] = 0x56; // V
  buf[13] = 0x50; // P
  buf[14] = 0x38; // 8
  buf[15] = 0x20; // (space - lossy)

  // VP8 chunk size
  buf.writeUInt32LE(buf.length - 20, 16);

  // Frame tag (3 bytes) — keyframe
  buf[20] = 0x9D;
  buf[21] = 0x01;
  buf[22] = 0x2A;

  // Start code is part of the frame tag; now width and height
  // Actually for VP8 lossy, the layout after chunk header is:
  // 3 bytes frame tag, then start code 9D 01 2A, then width LE (14 bits), height LE (14 bits)
  // Let me fix the offsets:
  // Chunk data starts at offset 20
  // Bytes 0-2: frame tag
  buf[20] = 0x00; // frame tag byte 0
  buf[21] = 0x00; // frame tag byte 1
  buf[22] = 0x00; // frame tag byte 2

  // Bytes 3-5: start code 9D 01 2A
  buf[23] = 0x9D;
  buf[24] = 0x01;
  buf[25] = 0x2A;

  // Bytes 6-7: width (16-bit LE, lower 14 bits are width)
  buf.writeUInt16LE(width & 0x3FFF, 26);
  // Bytes 8-9: height (16-bit LE, lower 14 bits are height)
  buf.writeUInt16LE(height & 0x3FFF, 28);

  return buf;
}

/**
 * Create a minimal valid WebP buffer with given dimensions (VP8L lossless).
 */
export function createMinimalWebpVP8L(width: number, height: number): Buffer {
  const buf = Buffer.alloc(25);

  // RIFF header
  buf[0] = 0x52; // R
  buf[1] = 0x49; // I
  buf[2] = 0x46; // F
  buf[3] = 0x46; // F
  buf.writeUInt32LE(buf.length - 8, 4);

  // WEBP
  buf[8] = 0x57;
  buf[9] = 0x45;
  buf[10] = 0x42;
  buf[11] = 0x50;

  // VP8L chunk
  buf[12] = 0x56; // V
  buf[13] = 0x50; // P
  buf[14] = 0x38; // 8
  buf[15] = 0x4C; // L

  // VP8L chunk size
  buf.writeUInt32LE(5, 16);

  // Signature byte
  buf[20] = 0x2F;

  // Width-1 (14 bits) | height-1 (14 bits) packed into 4 bytes LE
  const w = (width - 1) & 0x3FFF;
  const h = (height - 1) & 0x3FFF;
  const bits = w | (h << 14);
  buf.writeUInt32LE(bits, 21);

  return buf;
}

/**
 * Create a minimal valid WebP buffer with given dimensions (VP8X extended).
 */
export function createMinimalWebpVP8X(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);

  // RIFF header
  buf[0] = 0x52;
  buf[1] = 0x49;
  buf[2] = 0x46;
  buf[3] = 0x46;
  buf.writeUInt32LE(buf.length - 8, 4);

  // WEBP
  buf[8] = 0x57;
  buf[9] = 0x45;
  buf[10] = 0x42;
  buf[11] = 0x50;

  // VP8X chunk
  buf[12] = 0x56; // V
  buf[13] = 0x50; // P
  buf[14] = 0x38; // 8
  buf[15] = 0x58; // X

  // VP8X chunk size (10 bytes)
  buf.writeUInt32LE(10, 16);

  // Flags (4 bytes)
  buf.writeUInt32LE(0, 20);

  // Canvas width - 1 (3 bytes LE)
  const w = width - 1;
  buf[24] = w & 0xFF;
  buf[25] = (w >> 8) & 0xFF;
  buf[26] = (w >> 16) & 0xFF;

  // Canvas height - 1 (3 bytes LE)
  const h = height - 1;
  buf[27] = h & 0xFF;
  buf[28] = (h >> 8) & 0xFF;
  buf[29] = (h >> 16) & 0xFF;

  return buf;
}

/**
 * Create a minimal valid BMP buffer with given dimensions.
 * BMP format:
 *   14-byte file header
 *   40-byte DIB header (BITMAPINFOHEADER)
 */
export function createMinimalBmp(width: number, height: number): Buffer {
  const headerSize = 14 + 40;
  const buf = Buffer.alloc(headerSize);

  // BM signature
  buf[0] = 0x42; // B
  buf[1] = 0x4D; // M

  // File size
  buf.writeUInt32LE(headerSize, 2);

  // Reserved
  buf.writeUInt32LE(0, 6);

  // Pixel data offset
  buf.writeUInt32LE(headerSize, 10);

  // DIB header size (BITMAPINFOHEADER = 40)
  buf.writeUInt32LE(40, 14);

  // Width (signed 32-bit LE)
  buf.writeInt32LE(width, 18);

  // Height (signed 32-bit LE)
  buf.writeInt32LE(height, 22);

  // Planes
  buf.writeUInt16LE(1, 26);

  // Bits per pixel
  buf.writeUInt16LE(24, 28);

  // Compression (0 = none)
  buf.writeUInt32LE(0, 30);

  return buf;
}
