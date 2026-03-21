import type { ImageMimeType, GeminiContentBlock } from '../types';

/**
 * Format an image as a Gemini vision content block.
 */
export function formatGeminiContentBlock(
  base64: string,
  mimeType: ImageMimeType,
): GeminiContentBlock {
  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

/** Gemini maximum file size in bytes: 20 MB. */
export const GEMINI_MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Gemini supported formats. */
export const GEMINI_SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp', 'bmp']);
