import type { ImageMimeType, AnthropicContentBlock } from '../types';

/**
 * Format an image as an Anthropic vision content block.
 */
export function formatAnthropicContentBlock(
  base64: string,
  mimeType: ImageMimeType,
): AnthropicContentBlock {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType,
      data: base64,
    },
  };
}

/** Anthropic maximum file size in bytes: 5 MB. */
export const ANTHROPIC_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Anthropic supported formats. */
export const ANTHROPIC_SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp']);
