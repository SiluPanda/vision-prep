import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  prepare,
  prepareForOpenAI,
  prepareForAnthropic,
  prepareForGemini,
  estimateTokens,
  prepareBatch,
  createPreparer,
  _classifySource,
} from '../prepare';
import {
  createMinimalPng,
  createMinimalJpeg,
  createMinimalGif,
  createMinimalWebpVP8,
  createMinimalBmp,
} from './test-helpers';

// ── Source Classification ───────────────────────────────────────────

describe('_classifySource', () => {
  it('classifies HTTP URL', () => {
    expect(_classifySource('http://example.com/img.jpg')).toBe('url');
  });

  it('classifies HTTPS URL', () => {
    expect(_classifySource('https://cdn.example.com/photo.png')).toBe('url');
  });

  it('classifies data URL', () => {
    expect(_classifySource('data:image/png;base64,abc123')).toBe('data-url');
  });

  it('classifies file path', () => {
    expect(_classifySource('/home/user/photo.jpg')).toBe('file');
    expect(_classifySource('./image.png')).toBe('file');
    expect(_classifySource('images/test.gif')).toBe('file');
  });

  it('classifies raw base64 (long string)', () => {
    const longBase64 = 'A'.repeat(300);
    expect(_classifySource(longBase64)).toBe('base64');
  });

  it('classifies short base64-like string as file path', () => {
    const shortBase64 = 'abc123';
    expect(_classifySource(shortBase64)).toBe('file');
  });
});

// ── prepare with Buffer input ───────────────────────────────────────

describe('prepare', () => {
  describe('with Buffer input', () => {
    it('prepares PNG for OpenAI', async () => {
      const buf = createMinimalPng(1024, 768);
      const result = await prepare(buf, 'openai');
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.tokens).toBe(765);
      expect(result.provider).toBe('openai');
      expect(result.detail).toBe('high');
      expect(result.base64).toBe(buf.toString('base64'));
      expect(result.original.width).toBe(1024);
      expect(result.original.height).toBe(768);
      expect(result.original.bytes).toBe(buf.length);
    });

    it('prepares JPEG for Anthropic', async () => {
      const buf = createMinimalJpeg(800, 600);
      const result = await prepare(buf, 'anthropic');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.tokens).toBe(Math.ceil((800 * 600) / 750));
      expect(result.provider).toBe('anthropic');
      expect(result.detail).toBeUndefined();
    });

    it('prepares GIF for Gemini', async () => {
      const buf = createMinimalGif(640, 480);
      const result = await prepare(buf, 'gemini');
      expect(result.mimeType).toBe('image/gif');
      expect(result.tokens).toBe(258);
      expect(result.provider).toBe('gemini');
    });

    it('prepares WebP for OpenAI', async () => {
      const buf = createMinimalWebpVP8(512, 512);
      const result = await prepare(buf, 'openai', { detail: 'low' });
      expect(result.mimeType).toBe('image/webp');
      expect(result.tokens).toBe(85);
      expect(result.detail).toBe('low');
    });

    it('rejects BMP for OpenAI (unsupported format)', async () => {
      const buf = createMinimalBmp(100, 100);
      await expect(prepare(buf, 'openai')).rejects.toThrow('not supported by openai');
    });

    it('rejects BMP for Anthropic (unsupported format)', async () => {
      const buf = createMinimalBmp(100, 100);
      await expect(prepare(buf, 'anthropic')).rejects.toThrow('not supported by anthropic');
    });

    it('accepts BMP for Gemini', async () => {
      const buf = createMinimalBmp(100, 100);
      const result = await prepare(buf, 'gemini');
      expect(result.mimeType).toBe('image/bmp');
    });
  });

  describe('with Uint8Array input', () => {
    it('prepares Uint8Array as PNG', async () => {
      const png = createMinimalPng(256, 256);
      const uint8 = new Uint8Array(png);
      const result = await prepare(uint8, 'openai');
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(256);
      expect(result.height).toBe(256);
    });
  });

  describe('with base64 string input', () => {
    it('prepares base64 data URL', async () => {
      const buf = createMinimalPng(100, 100);
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      const result = await prepare(dataUrl, 'openai');
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('prepares raw base64 string', async () => {
      const buf = createMinimalPng(200, 150);
      // Pad to > 260 chars so it's classified as base64
      const base64 = buf.toString('base64');
      const padded = base64 + 'A'.repeat(Math.max(0, 261 - base64.length));
      const result = await prepare(padded, 'anthropic');
      expect(result.mimeType).toBe('image/png');
    });
  });

  describe('with file path input', () => {
    const tmpDir = path.join(process.cwd(), '.tmp-test-images');

    beforeEach(() => {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    });

    it('prepares image from file path', async () => {
      const buf = createMinimalPng(640, 480);
      const filePath = path.join(tmpDir, 'test.png');
      fs.writeFileSync(filePath, buf);

      try {
        const result = await prepare(filePath, 'openai');
        expect(result.mimeType).toBe('image/png');
        expect(result.width).toBe(640);
        expect(result.height).toBe(480);
      } finally {
        fs.unlinkSync(filePath);
      }
    });

    it('throws for nonexistent file', async () => {
      await expect(prepare('/nonexistent/image.png', 'openai'))
        .rejects.toThrow('Image not found');
    });
  });

  describe('content blocks', () => {
    it('OpenAI content block has data URL with detail', async () => {
      const buf = createMinimalPng(100, 100);
      const result = await prepare(buf, 'openai', { detail: 'high' });
      const block = result.contentBlock as { type: string; image_url: { url: string; detail: string } };
      expect(block.type).toBe('image_url');
      expect(block.image_url.url).toMatch(/^data:image\/png;base64,/);
      expect(block.image_url.detail).toBe('high');
    });

    it('Anthropic content block has raw base64', async () => {
      const buf = createMinimalJpeg(100, 100);
      const result = await prepare(buf, 'anthropic');
      const block = result.contentBlock as { type: string; source: { type: string; media_type: string; data: string } };
      expect(block.type).toBe('image');
      expect(block.source.type).toBe('base64');
      expect(block.source.media_type).toBe('image/jpeg');
      expect(block.source.data).toBe(buf.toString('base64'));
    });

    it('Gemini content block has inlineData', async () => {
      const buf = createMinimalGif(100, 100);
      const result = await prepare(buf, 'gemini');
      const block = result.contentBlock as { inlineData: { mimeType: string; data: string } };
      expect(block.inlineData.mimeType).toBe('image/gif');
      expect(block.inlineData.data).toBe(buf.toString('base64'));
    });
  });

  describe('auto detail mode', () => {
    it('auto detail resolves to high in content block', async () => {
      const buf = createMinimalPng(800, 600);
      const result = await prepare(buf, 'openai', { detail: 'auto' });
      expect(result.detail).toBe('high');
    });
  });

  describe('custom dimensions', () => {
    it('applies custom maxWidth constraint', async () => {
      const buf = createMinimalPng(2000, 1500);
      const result = await prepare(buf, 'openai', { maxWidth: 500 });
      expect(result.width).toBeLessThanOrEqual(500);
    });

    it('applies custom maxHeight constraint', async () => {
      const buf = createMinimalPng(2000, 1500);
      const result = await prepare(buf, 'openai', { maxHeight: 400 });
      expect(result.height).toBeLessThanOrEqual(400);
    });

    it('token estimate reflects custom dimensions, not original', async () => {
      const buf = createMinimalPng(2000, 1500);
      const unconstrained = await prepare(buf, 'openai', { detail: 'high' });
      const constrained = await prepare(buf, 'openai', { detail: 'high', maxWidth: 500 });
      // Constrained image is smaller, so it should use fewer tokens
      expect(constrained.tokens).toBeLessThan(unconstrained.tokens);
      expect(constrained.width).toBeLessThanOrEqual(500);
    });
  });
});

// ── Convenience Functions ───────────────────────────────────────────

describe('prepareForOpenAI', () => {
  it('is equivalent to prepare with openai provider', async () => {
    const buf = createMinimalPng(512, 512);
    const result = await prepareForOpenAI(buf, { detail: 'high' });
    expect(result.provider).toBe('openai');
    expect(result.tokens).toBe(255);
  });
});

describe('prepareForAnthropic', () => {
  it('is equivalent to prepare with anthropic provider', async () => {
    const buf = createMinimalJpeg(1024, 768);
    const result = await prepareForAnthropic(buf);
    expect(result.provider).toBe('anthropic');
  });
});

describe('prepareForGemini', () => {
  it('is equivalent to prepare with gemini provider', async () => {
    const buf = createMinimalGif(640, 480);
    const result = await prepareForGemini(buf);
    expect(result.provider).toBe('gemini');
    expect(result.tokens).toBe(258);
  });
});

// ── estimateTokens ──────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('estimates from dimensions object', async () => {
    const result = await estimateTokens({ width: 1920, height: 1080 }, 'openai', { detail: 'high' });
    expect(result.tokens).toBe(1105);
    expect(result.provider).toBe('openai');
  });

  it('estimates from Buffer', async () => {
    const buf = createMinimalPng(1024, 768);
    const result = await estimateTokens(buf, 'anthropic');
    expect(result.tokens).toBe(Math.ceil((1024 * 768) / 750));
  });

  it('estimates Gemini from dimensions', async () => {
    const result = await estimateTokens({ width: 100, height: 100 }, 'gemini');
    expect(result.tokens).toBe(258);
  });

  it('estimates OpenAI low from dimensions', async () => {
    const result = await estimateTokens({ width: 4000, height: 3000 }, 'openai', { detail: 'low' });
    expect(result.tokens).toBe(85);
  });
});

// ── prepareBatch ────────────────────────────────────────────────────

describe('prepareBatch', () => {
  it('processes multiple images', async () => {
    const images = [
      createMinimalPng(512, 512),
      createMinimalJpeg(1024, 768),
      createMinimalGif(640, 480),
    ];

    const result = await prepareBatch(images, 'openai', { detail: 'high' });
    expect(result.images.length).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('continues on error when configured', async () => {
    const images = [
      createMinimalPng(100, 100),
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]), // invalid
      createMinimalJpeg(200, 200),
    ];

    const result = await prepareBatch(images, 'openai', { continueOnError: true });
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);

    const errorResult = result.images[1] as { index: number; error: { code: string; message: string } };
    expect(errorResult.index).toBe(1);
    expect(errorResult.error.code).toBe('PREPARE_FAILED');
  });

  it('fails fast by default', async () => {
    const images = [
      createMinimalPng(100, 100),
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]), // invalid
      createMinimalJpeg(200, 200),
    ];

    await expect(prepareBatch(images, 'openai')).rejects.toThrow();
  });

  it('handles empty array', async () => {
    const result = await prepareBatch([], 'openai');
    expect(result.images.length).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('respects concurrency option', async () => {
    const images = Array.from({ length: 10 }, () => createMinimalPng(50, 50));
    const result = await prepareBatch(images, 'anthropic', { concurrency: 2 });
    expect(result.succeeded).toBe(10);
  });
});

// ── createPreparer ──────────────────────────────────────────────────

describe('createPreparer', () => {
  it('creates preparer with pre-configured provider', async () => {
    const preparer = createPreparer({ provider: 'openai', detail: 'high' });
    const buf = createMinimalPng(512, 512);
    const result = await preparer.prepare(buf);
    expect(result.provider).toBe('openai');
    expect(result.detail).toBe('high');
  });

  it('preparer.prepareBatch works', async () => {
    const preparer = createPreparer({ provider: 'anthropic' });
    const images = [createMinimalPng(100, 100), createMinimalJpeg(200, 200)];
    const result = await preparer.prepareBatch(images);
    expect(result.succeeded).toBe(2);
  });

  it('preparer.estimateTokens works', async () => {
    const preparer = createPreparer({ provider: 'gemini' });
    const result = await preparer.estimateTokens({ width: 1000, height: 1000 });
    expect(result.tokens).toBe(258);
  });

  it('allows overriding options in individual calls', async () => {
    const preparer = createPreparer({ provider: 'openai', detail: 'high' });
    const buf = createMinimalPng(1024, 768);
    const result = await preparer.prepare(buf, { detail: 'low' });
    expect(result.tokens).toBe(85);
    expect(result.detail).toBe('low');
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────

describe('edge cases', () => {
  it('throws for invalid data URL (missing comma)', async () => {
    await expect(prepare('data:image/png;base64NOCOMMA', 'openai'))
      .rejects.toThrow();
  });

  it('throws for unrecognized image data', async () => {
    const buf = Buffer.alloc(100, 0x42); // All 0x42 = "BBB..." looks like BMP header
    // This starts with 0x42 0x42 which is BMP magic bytes
    // but the dimensions will be garbage; let's use truly random
    const randomBuf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    await expect(prepare(randomBuf, 'openai')).rejects.toThrow();
  });

  it('handles 1x1 pixel image', async () => {
    const buf = createMinimalPng(1, 1);
    const result = await prepare(buf, 'openai');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});
