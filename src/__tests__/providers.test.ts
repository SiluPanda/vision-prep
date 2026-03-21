import { describe, it, expect } from 'vitest';
import {
  formatOpenAIContentBlock,
  formatAnthropicContentBlock,
  formatGeminiContentBlock,
  formatContentBlock,
  getMaxFileSize,
  isFormatSupported,
} from '../providers';

// ── OpenAI Content Block ────────────────────────────────────────────

describe('formatOpenAIContentBlock', () => {
  it('formats with data URL and detail', () => {
    const block = formatOpenAIContentBlock('abc123', 'image/jpeg', 'high');
    expect(block).toEqual({
      type: 'image_url',
      image_url: {
        url: 'data:image/jpeg;base64,abc123',
        detail: 'high',
      },
    });
  });

  it('includes low detail mode', () => {
    const block = formatOpenAIContentBlock('data', 'image/png', 'low');
    expect(block.image_url.detail).toBe('low');
    expect(block.image_url.url).toBe('data:image/png;base64,data');
  });

  it('includes auto detail mode', () => {
    const block = formatOpenAIContentBlock('data', 'image/webp', 'auto');
    expect(block.image_url.detail).toBe('auto');
  });

  it('omits detail when undefined', () => {
    const block = formatOpenAIContentBlock('data', 'image/jpeg');
    expect(block.image_url.detail).toBeUndefined();
    expect(block.type).toBe('image_url');
  });

  it('uses correct MIME type in data URL', () => {
    const block = formatOpenAIContentBlock('data', 'image/gif', 'high');
    expect(block.image_url.url).toMatch(/^data:image\/gif;base64,/);
  });
});

// ── Anthropic Content Block ─────────────────────────────────────────

describe('formatAnthropicContentBlock', () => {
  it('formats with raw base64 and media_type', () => {
    const block = formatAnthropicContentBlock('abc123', 'image/jpeg');
    expect(block).toEqual({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: 'abc123',
      },
    });
  });

  it('uses PNG MIME type correctly', () => {
    const block = formatAnthropicContentBlock('pngdata', 'image/png');
    expect(block.source.media_type).toBe('image/png');
    expect(block.source.data).toBe('pngdata');
  });

  it('source type is always base64', () => {
    const block = formatAnthropicContentBlock('data', 'image/webp');
    expect(block.source.type).toBe('base64');
  });

  it('type is always image', () => {
    const block = formatAnthropicContentBlock('data', 'image/gif');
    expect(block.type).toBe('image');
  });
});

// ── Gemini Content Block ────────────────────────────────────────────

describe('formatGeminiContentBlock', () => {
  it('formats with inlineData', () => {
    const block = formatGeminiContentBlock('abc123', 'image/jpeg');
    expect(block).toEqual({
      inlineData: {
        mimeType: 'image/jpeg',
        data: 'abc123',
      },
    });
  });

  it('uses correct MIME type', () => {
    const block = formatGeminiContentBlock('data', 'image/png');
    expect(block.inlineData.mimeType).toBe('image/png');
  });

  it('supports BMP (Gemini-specific)', () => {
    const block = formatGeminiContentBlock('bmpdata', 'image/bmp');
    expect(block.inlineData.mimeType).toBe('image/bmp');
    expect(block.inlineData.data).toBe('bmpdata');
  });
});

// ── formatContentBlock (dispatcher) ─────────────────────────────────

describe('formatContentBlock', () => {
  it('dispatches to OpenAI formatter', () => {
    const block = formatContentBlock('openai', 'data', 'image/jpeg', 'high');
    expect(block).toHaveProperty('type', 'image_url');
  });

  it('dispatches to Anthropic formatter', () => {
    const block = formatContentBlock('anthropic', 'data', 'image/jpeg');
    expect(block).toHaveProperty('type', 'image');
  });

  it('dispatches to Gemini formatter', () => {
    const block = formatContentBlock('gemini', 'data', 'image/jpeg');
    expect(block).toHaveProperty('inlineData');
  });
});

// ── getMaxFileSize ──────────────────────────────────────────────────

describe('getMaxFileSize', () => {
  it('returns 20MB for OpenAI', () => {
    expect(getMaxFileSize('openai')).toBe(20 * 1024 * 1024);
  });

  it('returns 5MB for Anthropic', () => {
    expect(getMaxFileSize('anthropic')).toBe(5 * 1024 * 1024);
  });

  it('returns 20MB for Gemini', () => {
    expect(getMaxFileSize('gemini')).toBe(20 * 1024 * 1024);
  });
});

// ── isFormatSupported ───────────────────────────────────────────────

describe('isFormatSupported', () => {
  it('OpenAI supports jpeg, png, gif, webp', () => {
    expect(isFormatSupported('openai', 'jpeg')).toBe(true);
    expect(isFormatSupported('openai', 'png')).toBe(true);
    expect(isFormatSupported('openai', 'gif')).toBe(true);
    expect(isFormatSupported('openai', 'webp')).toBe(true);
  });

  it('OpenAI does not support bmp', () => {
    expect(isFormatSupported('openai', 'bmp')).toBe(false);
  });

  it('Anthropic supports jpeg, png, gif, webp', () => {
    expect(isFormatSupported('anthropic', 'jpeg')).toBe(true);
    expect(isFormatSupported('anthropic', 'png')).toBe(true);
    expect(isFormatSupported('anthropic', 'gif')).toBe(true);
    expect(isFormatSupported('anthropic', 'webp')).toBe(true);
  });

  it('Anthropic does not support bmp', () => {
    expect(isFormatSupported('anthropic', 'bmp')).toBe(false);
  });

  it('Gemini supports jpeg, png, gif, webp, bmp', () => {
    expect(isFormatSupported('gemini', 'jpeg')).toBe(true);
    expect(isFormatSupported('gemini', 'png')).toBe(true);
    expect(isFormatSupported('gemini', 'gif')).toBe(true);
    expect(isFormatSupported('gemini', 'webp')).toBe(true);
    expect(isFormatSupported('gemini', 'bmp')).toBe(true);
  });

  it('returns false for unsupported format', () => {
    expect(isFormatSupported('openai', 'tiff')).toBe(false);
    expect(isFormatSupported('anthropic', 'svg')).toBe(false);
  });
});
