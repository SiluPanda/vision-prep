import type {
  Provider,
  ImageMimeType,
  OpenAIContentBlock,
  AnthropicContentBlock,
  GeminiContentBlock,
} from '../types';
import { formatOpenAIContentBlock, OPENAI_MAX_FILE_SIZE, OPENAI_SUPPORTED_FORMATS } from './openai';
import { formatAnthropicContentBlock, ANTHROPIC_MAX_FILE_SIZE, ANTHROPIC_SUPPORTED_FORMATS } from './anthropic';
import { formatGeminiContentBlock, GEMINI_MAX_FILE_SIZE, GEMINI_SUPPORTED_FORMATS } from './gemini';

export {
  formatOpenAIContentBlock,
  formatAnthropicContentBlock,
  formatGeminiContentBlock,
};

/**
 * Format a content block for the given provider.
 */
export function formatContentBlock(
  provider: Provider,
  base64: string,
  mimeType: ImageMimeType,
  detail?: 'low' | 'high' | 'auto',
): OpenAIContentBlock | AnthropicContentBlock | GeminiContentBlock {
  switch (provider) {
    case 'openai':
      return formatOpenAIContentBlock(base64, mimeType, detail);
    case 'anthropic':
      return formatAnthropicContentBlock(base64, mimeType);
    case 'gemini':
      return formatGeminiContentBlock(base64, mimeType);
  }
}

/**
 * Get the maximum file size for a provider in bytes.
 */
export function getMaxFileSize(provider: Provider): number {
  switch (provider) {
    case 'openai': return OPENAI_MAX_FILE_SIZE;
    case 'anthropic': return ANTHROPIC_MAX_FILE_SIZE;
    case 'gemini': return GEMINI_MAX_FILE_SIZE;
  }
}

/**
 * Check if a format is supported by a provider.
 */
export function isFormatSupported(provider: Provider, format: string): boolean {
  switch (provider) {
    case 'openai': return OPENAI_SUPPORTED_FORMATS.has(format);
    case 'anthropic': return ANTHROPIC_SUPPORTED_FORMATS.has(format);
    case 'gemini': return GEMINI_SUPPORTED_FORMATS.has(format);
  }
}
