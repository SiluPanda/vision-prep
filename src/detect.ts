import type { ImageInfo, ImageMimeType } from './types';

/**
 * Detect image format from magic bytes.
 * Supported: PNG, JPEG, GIF, WebP, BMP.
 */
export function detectFormat(buffer: Buffer | Uint8Array): 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // GIF: 47 49 46 (GIF87a or GIF89a)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'webp';
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'bmp';
  }

  return null;
}

/**
 * Map format string to MIME type.
 */
export function formatToMimeType(format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp'): ImageMimeType {
  const map: Record<string, ImageMimeType> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };
  return map[format];
}

/**
 * Extract PNG dimensions from IHDR chunk.
 * PNG structure: 8-byte signature, then IHDR chunk:
 *   4 bytes length, 4 bytes "IHDR", 4 bytes width (big-endian), 4 bytes height (big-endian)
 */
function extractPngDimensions(buffer: Buffer | Uint8Array): { width: number; height: number } | null {
  // Need at least 24 bytes: 8 signature + 4 length + 4 IHDR + 4 width + 4 height
  if (buffer.length < 24) return null;

  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Verify IHDR chunk type at offset 12
  if (buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52) {
    return null;
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/**
 * Extract JPEG dimensions by scanning for SOF (Start of Frame) marker.
 * SOF markers: FF C0 through FF CF (except FF C4 DHT and FF CC DAC)
 */
function extractJpegDimensions(buffer: Buffer | Uint8Array): { width: number; height: number } | null {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (buf.length < 4) return null;

  let offset = 2; // Skip SOI marker (FF D8)

  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = buf[offset + 1];

    // SOF markers: C0-CF except C4 (DHT) and CC (DAC) and C8 (reserved)
    if (
      marker >= 0xC0 && marker <= 0xCF &&
      marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC
    ) {
      // SOF structure: FF Cx, 2 bytes length, 1 byte precision, 2 bytes height, 2 bytes width
      if (offset + 9 > buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }

    // Skip to next marker
    if (offset + 3 >= buf.length) return null;
    const segmentLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Extract GIF dimensions from header.
 * GIF structure: 6 bytes signature, 2 bytes width (LE), 2 bytes height (LE)
 */
function extractGifDimensions(buffer: Buffer | Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

/**
 * Extract WebP dimensions.
 * WebP VP8: starts with RIFF....WEBP, then VP8 chunk.
 * VP8 (lossy): after "VP8 " chunk header, skip 10 bytes, then 2 bytes width LE, 2 bytes height LE
 * VP8L (lossless): after "VP8L" chunk header, 1 byte signature (0x2F), then bit-packed width/height
 * VP8X (extended): after "VP8X" chunk header, 4 bytes flags, 3 bytes width-1 LE, 3 bytes height-1 LE
 */
function extractWebpDimensions(buffer: Buffer | Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 16) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // Check VP8X (extended format)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x58) {
    // VP8X: 4 bytes chunk header, 4 bytes chunk size, 4 bytes flags,
    //        3 bytes canvas width - 1 (LE), 3 bytes canvas height - 1 (LE)
    if (buf.length < 30) return null;
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width, height };
  }

  // Check VP8L (lossless)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x4C) {
    // VP8L: 4 bytes chunk header, 4 bytes chunk size, 1 byte signature (0x2F),
    //        then 4 bytes containing width-1 (14 bits) and height-1 (14 bits)
    if (buf.length < 25) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3FFF) + 1;
    const height = ((bits >> 14) & 0x3FFF) + 1;
    return { width, height };
  }

  // Check VP8 (lossy)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x20) {
    // VP8 lossy: chunk header (4+4 bytes), then 3-byte frame tag, 3-byte start code (9D 01 2A),
    //            then 2 bytes width LE (lower 14 bits), 2 bytes height LE (lower 14 bits)
    if (buf.length < 30) return null;
    const width = buf.readUInt16LE(26) & 0x3FFF;
    const height = buf.readUInt16LE(28) & 0x3FFF;
    return { width, height };
  }

  return null;
}

/**
 * Extract BMP dimensions from header.
 * BMP structure: 14-byte file header, then DIB header:
 *   4 bytes header size, 4 bytes width (LE signed), 4 bytes height (LE signed)
 */
function extractBmpDimensions(buffer: Buffer | Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 26) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const width = Math.abs(buf.readInt32LE(18));
  const height = Math.abs(buf.readInt32LE(22));
  return { width, height };
}

/**
 * Extract image dimensions from buffer without full decode.
 * Returns null if format is unrecognized or dimensions cannot be extracted.
 */
export function extractDimensions(
  buffer: Buffer | Uint8Array,
  format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp',
): { width: number; height: number } | null {
  switch (format) {
    case 'png': return extractPngDimensions(buffer);
    case 'jpeg': return extractJpegDimensions(buffer);
    case 'gif': return extractGifDimensions(buffer);
    case 'webp': return extractWebpDimensions(buffer);
    case 'bmp': return extractBmpDimensions(buffer);
    default: return null;
  }
}

/**
 * Detect format and extract full image info from a buffer.
 * Throws if format is unrecognized or dimensions cannot be extracted.
 */
export function getImageInfo(buffer: Buffer | Uint8Array): ImageInfo {
  const format = detectFormat(buffer);
  if (!format) {
    throw new Error('Unrecognized image format: could not detect format from magic bytes');
  }

  const dimensions = extractDimensions(buffer, format);
  if (!dimensions) {
    throw new Error(`Could not extract dimensions from ${format} image`);
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
    format,
    sizeBytes: buffer.length,
  };
}
