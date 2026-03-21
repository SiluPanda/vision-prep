import type { ImageMimeType, OpenAIContentBlock } from '../types';

/**
 * Format an image as an OpenAI vision content block.
 */
export function formatOpenAIContentBlock(
  base64: string,
  mimeType: ImageMimeType,
  detail?: 'low' | 'high' | 'auto',
): OpenAIContentBlock {
  const block: OpenAIContentBlock = {
    type: 'image_url',
    image_url: {
      url: `data:${mimeType};base64,${base64}`,
    },
  };

  if (detail !== undefined) {
    block.image_url.detail = detail;
  }

  return block;
}

/** OpenAI maximum file size in bytes: 20 MB. */
export const OPENAI_MAX_FILE_SIZE = 20 * 1024 * 1024;

/** OpenAI supported formats. */
export const OPENAI_SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp']);
