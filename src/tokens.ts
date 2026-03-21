import type { Provider, TokenEstimate, EstimateOptions } from './types';

/**
 * Apply OpenAI high-detail resize logic to get effective dimensions.
 */
export function openAIHighDetailResize(width: number, height: number): { width: number; height: number } {
  let w = width;
  let h = height;

  // Step 1: fit within 2048x2048
  if (w > 2048 || h > 2048) {
    const scale = Math.min(2048 / w, 2048 / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Step 2: scale shortest side to 768 (only shrink)
  const shortSide = Math.min(w, h);
  if (shortSide > 768) {
    const scale = 768 / shortSide;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  return { width: w, height: h };
}

/**
 * Estimate OpenAI vision tokens for given dimensions.
 */
export function estimateOpenAITokens(
  width: number,
  height: number,
  detail: 'low' | 'high' | 'auto' = 'high',
): number {
  if (detail === 'low') return 85;

  const resized = openAIHighDetailResize(width, height);
  const tilesX = Math.ceil(resized.width / 512);
  const tilesY = Math.ceil(resized.height / 512);
  return tilesX * tilesY * 170 + 85;
}

/**
 * Apply Anthropic resize logic to get effective dimensions.
 */
export function anthropicResize(width: number, height: number): { width: number; height: number } {
  let w = width;
  let h = height;

  // Step 1: longest side <= 1568
  const longSide = Math.max(w, h);
  if (longSide > 1568) {
    const scale = 1568 / longSide;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Step 2: total pixels <= 1,568,000
  if (w * h > 1_568_000) {
    const scale = Math.sqrt(1_568_000 / (w * h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  return { width: w, height: h };
}

/**
 * Estimate Anthropic vision tokens for given dimensions.
 */
export function estimateAnthropicTokens(width: number, height: number): number {
  const resized = anthropicResize(width, height);
  return Math.ceil((resized.width * resized.height) / 750);
}

/**
 * Estimate Gemini vision tokens (flat cost).
 */
export function estimateGeminiTokens(_width: number, _height: number): number {
  return 258;
}

/**
 * Get the effective dimensions after provider-specific resize logic.
 */
export function getProviderResizedDimensions(
  width: number,
  height: number,
  provider: Provider,
  detail: 'low' | 'high' | 'auto' = 'high',
): { width: number; height: number } {
  switch (provider) {
    case 'openai':
      if (detail === 'low') {
        // Resize to fit within 512x512
        if (width <= 512 && height <= 512) return { width, height };
        const scale = Math.min(512 / width, 512 / height);
        return {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        };
      }
      return openAIHighDetailResize(width, height);
    case 'anthropic':
      return anthropicResize(width, height);
    case 'gemini': {
      if (width <= 3600 && height <= 3600) return { width, height };
      const scale = Math.min(3600 / width, 3600 / height);
      return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      };
    }
  }
}

/**
 * Estimate vision tokens for given dimensions and provider.
 */
export function estimateTokensFromDimensions(
  width: number,
  height: number,
  provider: Provider,
  options?: EstimateOptions,
): TokenEstimate {
  const detail = options?.detail ?? 'high';
  let tokens: number;
  let resized: { width: number; height: number };

  switch (provider) {
    case 'openai':
      tokens = estimateOpenAITokens(width, height, detail);
      resized = detail === 'low'
        ? getProviderResizedDimensions(width, height, provider, detail)
        : openAIHighDetailResize(width, height);
      break;
    case 'anthropic':
      tokens = estimateAnthropicTokens(width, height);
      resized = anthropicResize(width, height);
      break;
    case 'gemini':
      tokens = estimateGeminiTokens(width, height);
      resized = getProviderResizedDimensions(width, height, provider);
      break;
  }

  const result: TokenEstimate = {
    tokens,
    width: resized.width,
    height: resized.height,
    provider,
  };

  if (options?.model) {
    // Cost estimation placeholder — in production this would use model-price-registry
    result.cost = undefined;
  }

  return result;
}
