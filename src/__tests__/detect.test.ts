import { describe, it, expect } from 'vitest';
import { detectFormat, extractDimensions, getImageInfo, formatToMimeType } from '../detect';
import {
  createMinimalPng,
  createMinimalJpeg,
  createMinimalGif,
  createMinimalWebpVP8,
  createMinimalWebpVP8L,
  createMinimalWebpVP8X,
  createMinimalBmp,
} from './test-helpers';

// ── detectFormat ────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects PNG from magic bytes', () => {
    const buf = createMinimalPng(100, 200);
    expect(detectFormat(buf)).toBe('png');
  });

  it('detects JPEG from magic bytes', () => {
    const buf = createMinimalJpeg(320, 240);
    expect(detectFormat(buf)).toBe('jpeg');
  });

  it('detects GIF from magic bytes', () => {
    const buf = createMinimalGif(640, 480);
    expect(detectFormat(buf)).toBe('gif');
  });

  it('detects WebP VP8 from magic bytes', () => {
    const buf = createMinimalWebpVP8(800, 600);
    expect(detectFormat(buf)).toBe('webp');
  });

  it('detects WebP VP8L from magic bytes', () => {
    const buf = createMinimalWebpVP8L(1024, 768);
    expect(detectFormat(buf)).toBe('webp');
  });

  it('detects WebP VP8X from magic bytes', () => {
    const buf = createMinimalWebpVP8X(1920, 1080);
    expect(detectFormat(buf)).toBe('webp');
  });

  it('detects BMP from magic bytes', () => {
    const buf = createMinimalBmp(500, 300);
    expect(detectFormat(buf)).toBe('bmp');
  });

  it('returns null for empty buffer', () => {
    expect(detectFormat(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for too-short buffer', () => {
    expect(detectFormat(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it('returns null for unknown format', () => {
    expect(detectFormat(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
  });

  it('works with Uint8Array input', () => {
    const png = createMinimalPng(50, 50);
    const uint8 = new Uint8Array(png);
    expect(detectFormat(uint8)).toBe('png');
  });

  it('detects PNG even with minimal 4 magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    expect(detectFormat(buf)).toBe('png');
  });

  it('detects JPEG even with just SOI + marker', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(detectFormat(buf)).toBe('jpeg');
  });

  it('detects GIF87a variant', () => {
    const buf = Buffer.alloc(14);
    buf[0] = 0x47; buf[1] = 0x49; buf[2] = 0x46;
    buf[3] = 0x38; buf[4] = 0x37; buf[5] = 0x61; // GIF87a
    expect(detectFormat(buf)).toBe('gif');
  });
});

// ── extractDimensions ───────────────────────────────────────────────

describe('extractDimensions', () => {
  describe('PNG', () => {
    it('extracts dimensions from small PNG', () => {
      const buf = createMinimalPng(1, 1);
      const dims = extractDimensions(buf, 'png');
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('extracts dimensions from typical PNG', () => {
      const buf = createMinimalPng(1920, 1080);
      const dims = extractDimensions(buf, 'png');
      expect(dims).toEqual({ width: 1920, height: 1080 });
    });

    it('extracts dimensions from large PNG', () => {
      const buf = createMinimalPng(4096, 3072);
      const dims = extractDimensions(buf, 'png');
      expect(dims).toEqual({ width: 4096, height: 3072 });
    });

    it('extracts dimensions from square PNG', () => {
      const buf = createMinimalPng(512, 512);
      const dims = extractDimensions(buf, 'png');
      expect(dims).toEqual({ width: 512, height: 512 });
    });

    it('returns null for truncated PNG', () => {
      const buf = createMinimalPng(100, 100).subarray(0, 20);
      const dims = extractDimensions(buf, 'png');
      expect(dims).toBeNull();
    });
  });

  describe('JPEG', () => {
    it('extracts dimensions from JPEG', () => {
      const buf = createMinimalJpeg(1024, 768);
      const dims = extractDimensions(buf, 'jpeg');
      expect(dims).toEqual({ width: 1024, height: 768 });
    });

    it('extracts dimensions from small JPEG', () => {
      const buf = createMinimalJpeg(32, 32);
      const dims = extractDimensions(buf, 'jpeg');
      expect(dims).toEqual({ width: 32, height: 32 });
    });

    it('extracts dimensions from landscape JPEG', () => {
      const buf = createMinimalJpeg(4000, 3000);
      const dims = extractDimensions(buf, 'jpeg');
      expect(dims).toEqual({ width: 4000, height: 3000 });
    });

    it('extracts dimensions from portrait JPEG', () => {
      const buf = createMinimalJpeg(600, 800);
      const dims = extractDimensions(buf, 'jpeg');
      expect(dims).toEqual({ width: 600, height: 800 });
    });

    it('returns null for truncated JPEG', () => {
      const buf = createMinimalJpeg(100, 100).subarray(0, 4);
      const dims = extractDimensions(buf, 'jpeg');
      expect(dims).toBeNull();
    });
  });

  describe('GIF', () => {
    it('extracts dimensions from GIF', () => {
      const buf = createMinimalGif(640, 480);
      const dims = extractDimensions(buf, 'gif');
      expect(dims).toEqual({ width: 640, height: 480 });
    });

    it('extracts dimensions from small GIF', () => {
      const buf = createMinimalGif(1, 1);
      const dims = extractDimensions(buf, 'gif');
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('extracts dimensions from wide GIF', () => {
      const buf = createMinimalGif(2000, 100);
      const dims = extractDimensions(buf, 'gif');
      expect(dims).toEqual({ width: 2000, height: 100 });
    });

    it('returns null for truncated GIF', () => {
      const buf = createMinimalGif(100, 100).subarray(0, 8);
      const dims = extractDimensions(buf, 'gif');
      expect(dims).toBeNull();
    });
  });

  describe('WebP VP8 (lossy)', () => {
    it('extracts dimensions from VP8 WebP', () => {
      const buf = createMinimalWebpVP8(800, 600);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it('extracts dimensions from small VP8 WebP', () => {
      const buf = createMinimalWebpVP8(64, 64);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 64, height: 64 });
    });
  });

  describe('WebP VP8L (lossless)', () => {
    it('extracts dimensions from VP8L WebP', () => {
      const buf = createMinimalWebpVP8L(1024, 768);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 1024, height: 768 });
    });

    it('extracts dimensions from small VP8L WebP', () => {
      const buf = createMinimalWebpVP8L(16, 16);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 16, height: 16 });
    });

    it('extracts dimensions from large VP8L WebP', () => {
      const buf = createMinimalWebpVP8L(4000, 3000);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 4000, height: 3000 });
    });
  });

  describe('WebP VP8X (extended)', () => {
    it('extracts dimensions from VP8X WebP', () => {
      const buf = createMinimalWebpVP8X(1920, 1080);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 1920, height: 1080 });
    });

    it('extracts dimensions from large VP8X WebP', () => {
      const buf = createMinimalWebpVP8X(3840, 2160);
      const dims = extractDimensions(buf, 'webp');
      expect(dims).toEqual({ width: 3840, height: 2160 });
    });
  });

  describe('BMP', () => {
    it('extracts dimensions from BMP', () => {
      const buf = createMinimalBmp(500, 300);
      const dims = extractDimensions(buf, 'bmp');
      expect(dims).toEqual({ width: 500, height: 300 });
    });

    it('extracts dimensions from small BMP', () => {
      const buf = createMinimalBmp(1, 1);
      const dims = extractDimensions(buf, 'bmp');
      expect(dims).toEqual({ width: 1, height: 1 });
    });

    it('handles BMP with negative height (top-down)', () => {
      const buf = createMinimalBmp(200, 100);
      // Write negative height to simulate top-down BMP
      buf.writeInt32LE(-100, 22);
      const dims = extractDimensions(buf, 'bmp');
      expect(dims).toEqual({ width: 200, height: 100 });
    });

    it('returns null for truncated BMP', () => {
      const buf = createMinimalBmp(100, 100).subarray(0, 20);
      const dims = extractDimensions(buf, 'bmp');
      expect(dims).toBeNull();
    });
  });
});

// ── getImageInfo ────────────────────────────────────────────────────

describe('getImageInfo', () => {
  it('returns full info for PNG', () => {
    const buf = createMinimalPng(800, 600);
    const info = getImageInfo(buf);
    expect(info.format).toBe('png');
    expect(info.width).toBe(800);
    expect(info.height).toBe(600);
    expect(info.sizeBytes).toBe(buf.length);
  });

  it('returns full info for JPEG', () => {
    const buf = createMinimalJpeg(1920, 1080);
    const info = getImageInfo(buf);
    expect(info.format).toBe('jpeg');
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.sizeBytes).toBe(buf.length);
  });

  it('returns full info for GIF', () => {
    const buf = createMinimalGif(320, 240);
    const info = getImageInfo(buf);
    expect(info.format).toBe('gif');
    expect(info.width).toBe(320);
    expect(info.height).toBe(240);
  });

  it('returns full info for WebP', () => {
    const buf = createMinimalWebpVP8(640, 480);
    const info = getImageInfo(buf);
    expect(info.format).toBe('webp');
    expect(info.width).toBe(640);
    expect(info.height).toBe(480);
  });

  it('returns full info for BMP', () => {
    const buf = createMinimalBmp(256, 256);
    const info = getImageInfo(buf);
    expect(info.format).toBe('bmp');
    expect(info.width).toBe(256);
    expect(info.height).toBe(256);
  });

  it('throws for unrecognized format', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => getImageInfo(buf)).toThrow('Unrecognized image format');
  });

  it('throws for empty buffer', () => {
    expect(() => getImageInfo(Buffer.alloc(0))).toThrow('Unrecognized image format');
  });
});

// ── formatToMimeType ────────────────────────────────────────────────

describe('formatToMimeType', () => {
  it('maps jpeg to image/jpeg', () => {
    expect(formatToMimeType('jpeg')).toBe('image/jpeg');
  });

  it('maps png to image/png', () => {
    expect(formatToMimeType('png')).toBe('image/png');
  });

  it('maps gif to image/gif', () => {
    expect(formatToMimeType('gif')).toBe('image/gif');
  });

  it('maps webp to image/webp', () => {
    expect(formatToMimeType('webp')).toBe('image/webp');
  });

  it('maps bmp to image/bmp', () => {
    expect(formatToMimeType('bmp')).toBe('image/bmp');
  });
});
