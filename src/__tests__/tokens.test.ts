import { describe, it, expect } from 'vitest';
import {
  estimateOpenAITokens,
  estimateAnthropicTokens,
  estimateGeminiTokens,
  openAIHighDetailResize,
  anthropicResize,
  getProviderResizedDimensions,
  estimateTokensFromDimensions,
} from '../tokens';

// ── OpenAI High Detail Resize ───────────────────────────────────────

describe('openAIHighDetailResize', () => {
  it('does not resize image already within bounds', () => {
    expect(openAIHighDetailResize(512, 512)).toEqual({ width: 512, height: 512 });
  });

  it('does not resize 800x600 (both under 2048, short side under 768)', () => {
    expect(openAIHighDetailResize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('resizes 4000x3000: fit 2048 then scale short side to 768', () => {
    const result = openAIHighDetailResize(4000, 3000);
    expect(result).toEqual({ width: 1024, height: 768 });
  });

  it('resizes 1920x1080: short side > 768, scale to 768', () => {
    const result = openAIHighDetailResize(1920, 1080);
    // Short side is 1080 > 768, scale = 768/1080 = 0.7111
    // 1920 * 0.7111 = 1365, 1080 * 0.7111 = 768
    expect(result).toEqual({ width: 1365, height: 768 });
  });

  it('does not resize 256x256 (already small)', () => {
    expect(openAIHighDetailResize(256, 256)).toEqual({ width: 256, height: 256 });
  });

  it('handles portrait 3000x4000', () => {
    const result = openAIHighDetailResize(3000, 4000);
    // Step 1: scale to fit 2048. Scale = 2048/4000 = 0.512. -> 1536x2048
    // Step 2: short side 1536 > 768. Scale = 768/1536 = 0.5. -> 768x1024
    expect(result).toEqual({ width: 768, height: 1024 });
  });

  it('handles 2048x2048 (exactly at limit)', () => {
    const result = openAIHighDetailResize(2048, 2048);
    // Step 1: No scale (both = 2048)
    // Step 2: short side 2048 > 768. Scale = 768/2048 = 0.375. -> 768x768
    expect(result).toEqual({ width: 768, height: 768 });
  });

  it('handles 768x768 (exactly at short side limit)', () => {
    expect(openAIHighDetailResize(768, 768)).toEqual({ width: 768, height: 768 });
  });

  it('handles 1024x768 (short side exactly at limit)', () => {
    expect(openAIHighDetailResize(1024, 768)).toEqual({ width: 1024, height: 768 });
  });
});

// ── OpenAI Token Estimation ─────────────────────────────────────────

describe('estimateOpenAITokens', () => {
  it('returns 85 for low detail', () => {
    expect(estimateOpenAITokens(4000, 3000, 'low')).toBe(85);
  });

  it('returns 85 for low detail regardless of size', () => {
    expect(estimateOpenAITokens(100, 100, 'low')).toBe(85);
    expect(estimateOpenAITokens(8000, 6000, 'low')).toBe(85);
  });

  it('calculates 512x512 high detail: 1x1 tile = 255', () => {
    expect(estimateOpenAITokens(512, 512, 'high')).toBe(255);
  });

  it('calculates 1024x768 high detail: 2x2 tiles = 765', () => {
    expect(estimateOpenAITokens(1024, 768, 'high')).toBe(765);
  });

  it('calculates 4000x3000 high detail: resized to 1024x768, 2x2 = 765', () => {
    expect(estimateOpenAITokens(4000, 3000, 'high')).toBe(765);
  });

  it('calculates 1920x1080 high detail: resized to 1365x768, 3x2 = 1105', () => {
    expect(estimateOpenAITokens(1920, 1080, 'high')).toBe(1105);
  });

  it('calculates 800x600 high detail: 2x2 tiles = 765', () => {
    expect(estimateOpenAITokens(800, 600, 'high')).toBe(765);
  });

  it('calculates 256x256 high detail: 1x1 tile = 255', () => {
    expect(estimateOpenAITokens(256, 256, 'high')).toBe(255);
  });

  it('defaults to high detail when not specified', () => {
    expect(estimateOpenAITokens(512, 512)).toBe(255);
  });
});

// ── Anthropic Resize ────────────────────────────────────────────────

describe('anthropicResize', () => {
  it('does not resize image within bounds', () => {
    expect(anthropicResize(1024, 768)).toEqual({ width: 1024, height: 768 });
  });

  it('resizes 4000x3000: longest side then pixel cap', () => {
    const result = anthropicResize(4000, 3000);
    // Step 1: Scale = 1568/4000 = 0.392. -> 1568x1176
    // Step 2: Pixels = 1568*1176 = 1,843,968 > 1,568,000
    //   Scale = sqrt(1568000/1843968) ≈ 0.9222
    //   -> round(1568*0.9222) = 1446, round(1176*0.9222) = 1084
    expect(result.width).toBe(1446);
    expect(result.height).toBe(1084);
  });

  it('applies pixel cap after longest side constraint', () => {
    // 4000x3000: step 1 -> 1568x1176, pixels = 1,843,968 > 1,568,000
    const result = anthropicResize(4000, 3000);
    expect(result.width * result.height).toBeLessThanOrEqual(1_568_000 * 1.01); // Allow rounding
  });

  it('does not resize 256x256', () => {
    expect(anthropicResize(256, 256)).toEqual({ width: 256, height: 256 });
  });

  it('does not resize 1568x1000', () => {
    // Longest side = 1568, exactly at limit. Pixels = 1,568,000 exactly at limit.
    expect(anthropicResize(1568, 1000)).toEqual({ width: 1568, height: 1000 });
  });

  it('handles portrait image', () => {
    const result = anthropicResize(1000, 2000);
    // Step 1: longest = 2000 > 1568. Scale = 1568/2000 = 0.784. -> 784x1568
    expect(result).toEqual({ width: 784, height: 1568 });
  });
});

// ── Anthropic Token Estimation ──────────────────────────────────────

describe('estimateAnthropicTokens', () => {
  it('calculates tokens for 256x256: ceil(65536/750) = 88', () => {
    expect(estimateAnthropicTokens(256, 256)).toBe(88);
  });

  it('calculates tokens for 1024x768: ceil(786432/750) = 1049', () => {
    expect(estimateAnthropicTokens(1024, 768)).toBe(1049);
  });

  it('calculates tokens for 1920x1080 (resized first)', () => {
    // 1920x1080: longest = 1920 > 1568. Scale = 1568/1920 ≈ 0.8167. -> 1568x882
    // Pixels = 1,382,976 < 1,568,000. No pixel cap.
    // Tokens = ceil(1,382,976 / 750) = 1844
    expect(estimateAnthropicTokens(1920, 1080)).toBe(1844);
  });

  it('calculates tokens for small image (no resize)', () => {
    // 100x100 = 10,000 pixels. ceil(10000/750) = 14
    expect(estimateAnthropicTokens(100, 100)).toBe(14);
  });
});

// ── Gemini Token Estimation ─────────────────────────────────────────

describe('estimateGeminiTokens', () => {
  it('returns 258 for any dimensions', () => {
    expect(estimateGeminiTokens(100, 100)).toBe(258);
    expect(estimateGeminiTokens(4000, 3000)).toBe(258);
    expect(estimateGeminiTokens(1, 1)).toBe(258);
  });
});

// ── getProviderResizedDimensions ────────────────────────────────────

describe('getProviderResizedDimensions', () => {
  it('OpenAI low: fits 512x512', () => {
    expect(getProviderResizedDimensions(1024, 768, 'openai', 'low'))
      .toEqual({ width: 512, height: 384 });
  });

  it('OpenAI low: no resize if already small', () => {
    expect(getProviderResizedDimensions(256, 256, 'openai', 'low'))
      .toEqual({ width: 256, height: 256 });
  });

  it('OpenAI high: delegates to openAIHighDetailResize', () => {
    expect(getProviderResizedDimensions(4000, 3000, 'openai', 'high'))
      .toEqual({ width: 1024, height: 768 });
  });

  it('Anthropic: delegates to anthropicResize', () => {
    const result = getProviderResizedDimensions(1024, 768, 'anthropic');
    expect(result).toEqual({ width: 1024, height: 768 });
  });

  it('Gemini: fits 3600x3600', () => {
    expect(getProviderResizedDimensions(7200, 3600, 'gemini'))
      .toEqual({ width: 3600, height: 1800 });
  });

  it('Gemini: no resize if within bounds', () => {
    expect(getProviderResizedDimensions(1000, 1000, 'gemini'))
      .toEqual({ width: 1000, height: 1000 });
  });
});

// ── estimateTokensFromDimensions ────────────────────────────────────

describe('estimateTokensFromDimensions', () => {
  it('returns TokenEstimate for OpenAI high', () => {
    const result = estimateTokensFromDimensions(1024, 768, 'openai', { detail: 'high' });
    expect(result.tokens).toBe(765);
    expect(result.provider).toBe('openai');
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it('returns TokenEstimate for OpenAI low', () => {
    const result = estimateTokensFromDimensions(1024, 768, 'openai', { detail: 'low' });
    expect(result.tokens).toBe(85);
    expect(result.provider).toBe('openai');
  });

  it('returns TokenEstimate for Anthropic', () => {
    const result = estimateTokensFromDimensions(256, 256, 'anthropic');
    expect(result.tokens).toBe(88);
    expect(result.provider).toBe('anthropic');
  });

  it('returns TokenEstimate for Gemini', () => {
    const result = estimateTokensFromDimensions(1000, 1000, 'gemini');
    expect(result.tokens).toBe(258);
    expect(result.provider).toBe('gemini');
  });

  it('cost is undefined when no model specified', () => {
    const result = estimateTokensFromDimensions(1024, 768, 'openai');
    expect(result.cost).toBeUndefined();
  });
});
