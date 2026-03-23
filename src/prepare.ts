import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ImageSource,
  Provider,
  PrepareOptions,
  PreparedImage,
  BatchPrepareOptions,
  BatchResult,
  BatchError,
  TokenEstimate,
  EstimateOptions,
  ImageMimeType,
  PreparerConfig,
  ImagePreparer,
} from './types';
import { formatToMimeType, getImageInfo } from './detect';
import { estimateTokensFromDimensions, getProviderResizedDimensions } from './tokens';
import { formatContentBlock, getMaxFileSize, isFormatSupported } from './providers';

/**
 * Determine the type of an image source string.
 */
function classifySource(source: string): 'url' | 'data-url' | 'base64' | 'file' {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return 'url';
  }
  if (source.startsWith('data:')) {
    return 'data-url';
  }
  // Raw base64: only base64-valid chars and longer than max path length
  if (source.length > 260 && /^[A-Za-z0-9+/=\s]+$/.test(source)) {
    return 'base64';
  }
  return 'file';
}

/**
 * Resolve an ImageSource to a Buffer.
 */
async function resolveToBuffer(
  source: ImageSource,
  options?: Pick<PrepareOptions, 'fetchTimeout' | 'signal'>,
): Promise<Buffer> {
  if (Buffer.isBuffer(source)) {
    return source;
  }

  if (source instanceof Uint8Array) {
    return Buffer.from(source);
  }

  if (typeof source !== 'string') {
    throw new Error('Invalid image source: expected string, Buffer, or Uint8Array');
  }

  const kind = classifySource(source);

  switch (kind) {
    case 'file': {
      const filePath = path.resolve(source);
      try {
        return await fs.promises.readFile(filePath);
      } catch (err) {
        const error = err as Error & { code?: string };
        if (error.code === 'ENOENT') {
          throw new Error(`Image not found: ${filePath}`, { cause: err });
        }
        throw new Error(`Failed to read image file: ${error.message}`, { cause: err });
      }
    }

    case 'url': {
      const timeout = options?.fetchTimeout ?? 30_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      // Combine with caller's signal if provided
      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          throw new Error(`Image fetch timed out after ${timeout}ms`, { cause: err });
        }
        throw err as Error;
      } finally {
        clearTimeout(timer);
      }
    }

    case 'data-url': {
      // Parse data URL: data:[<mediatype>];base64,<data>
      const commaIndex = source.indexOf(',');
      if (commaIndex === -1) {
        throw new Error('Invalid data URL: missing comma separator');
      }
      const base64Data = source.slice(commaIndex + 1);
      return Buffer.from(base64Data, 'base64');
    }

    case 'base64': {
      return Buffer.from(source, 'base64');
    }
  }
}

/**
 * Prepare a single image for a vision LLM API.
 *
 * Without image processing dependencies (sharp/jimp), this function:
 * - Detects format and extracts dimensions from headers
 * - Validates against provider limits
 * - Encodes to base64 as-is (no resize/compress)
 * - Estimates tokens based on actual dimensions
 * - Formats the provider content block
 */
export async function prepare(
  image: ImageSource,
  provider: Provider,
  options?: PrepareOptions,
): Promise<PreparedImage> {
  // Step 1: Resolve to buffer
  const buffer = await resolveToBuffer(image, options);

  // Step 2: Detect format and dimensions
  const info = getImageInfo(buffer);
  const mimeType = formatToMimeType(info.format);

  // Validate format is supported by provider
  if (!isFormatSupported(provider, info.format)) {
    throw new Error(
      `Format '${info.format}' is not supported by ${provider}. ` +
      `Supported formats: jpeg, png, gif, webp${provider === 'gemini' ? ', bmp' : ''}`,
    );
  }

  // Validate file size
  const maxSize = getMaxFileSize(provider);
  if (buffer.length > maxSize) {
    throw new Error(
      `Image size (${buffer.length} bytes) exceeds ${provider} limit of ${maxSize} bytes (${Math.round(maxSize / 1024 / 1024)} MB)`,
    );
  }

  // Step 3: Calculate effective dimensions after provider resize logic
  const detail = options?.detail ?? 'high';
  const resized = getProviderResizedDimensions(
    info.width,
    info.height,
    provider,
    detail,
  );

  // Apply custom max dimensions if specified (as a further constraint)
  let effectiveWidth = resized.width;
  let effectiveHeight = resized.height;
  if (options?.maxWidth || options?.maxHeight) {
    const maxW = options.maxWidth ?? effectiveWidth;
    const maxH = options.maxHeight ?? effectiveHeight;
    if (effectiveWidth > maxW || effectiveHeight > maxH) {
      const scale = Math.min(maxW / effectiveWidth, maxH / effectiveHeight);
      effectiveWidth = Math.round(effectiveWidth * scale);
      effectiveHeight = Math.round(effectiveHeight * scale);
    }
  }

  // Step 4: Encode to base64 (no actual resize without sharp/jimp)
  const base64 = buffer.toString('base64');

  // Step 5: Estimate tokens (use effective dimensions after all constraints)
  const tokenEstimate = estimateTokensFromDimensions(
    effectiveWidth,
    effectiveHeight,
    provider,
    { detail, model: options?.model },
  );

  // Step 6: Format content block
  const effectiveDetail: 'low' | 'high' | undefined =
    provider === 'openai'
      ? (detail === 'auto' ? 'high' : detail)
      : undefined;

  const contentBlock = formatContentBlock(provider, base64, mimeType, effectiveDetail);

  // Step 7: Assemble result
  const result: PreparedImage = {
    base64,
    mimeType,
    width: effectiveWidth,
    height: effectiveHeight,
    tokens: tokenEstimate.tokens,
    bytes: buffer.length,
    original: {
      width: info.width,
      height: info.height,
      bytes: buffer.length,
      mimeType,
    },
    contentBlock,
    provider,
  };

  if (effectiveDetail !== undefined) {
    result.detail = effectiveDetail;
  }

  if (tokenEstimate.cost !== undefined) {
    result.cost = tokenEstimate.cost;
  }

  return result;
}

/**
 * Convenience: prepare for OpenAI.
 */
export async function prepareForOpenAI(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage> {
  return prepare(image, 'openai', options);
}

/**
 * Convenience: prepare for Anthropic.
 */
export async function prepareForAnthropic(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage> {
  return prepare(image, 'anthropic', options);
}

/**
 * Convenience: prepare for Gemini.
 */
export async function prepareForGemini(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage> {
  return prepare(image, 'gemini', options);
}

/**
 * Estimate tokens for an image without full preparation.
 * Accepts either dimensions { width, height } or an ImageSource.
 */
export async function estimateTokens(
  image: ImageSource | { width: number; height: number },
  provider: Provider,
  options?: EstimateOptions,
): Promise<TokenEstimate> {
  // If dimensions are provided directly
  if (
    typeof image === 'object' &&
    !Buffer.isBuffer(image) &&
    !(image instanceof Uint8Array) &&
    'width' in image &&
    'height' in image
  ) {
    return estimateTokensFromDimensions(
      image.width,
      image.height,
      provider,
      options,
    );
  }

  // Otherwise resolve the image to get dimensions
  const buffer = await resolveToBuffer(image as ImageSource);
  const info = getImageInfo(buffer);
  return estimateTokensFromDimensions(
    info.width,
    info.height,
    provider,
    options,
  );
}

/**
 * Process multiple images in parallel.
 */
export async function prepareBatch(
  images: ImageSource[],
  provider: Provider,
  options?: BatchPrepareOptions,
): Promise<BatchResult> {
  const concurrency = options?.concurrency ?? 4;
  const continueOnError = options?.continueOnError ?? false;

  const results: Array<PreparedImage | BatchError> = new Array(images.length);
  let totalTokens = 0;
  let totalCost: number | undefined;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let succeeded = 0;
  let failed = 0;

  // Process with concurrency control
  const queue = images.map((img, idx) => ({ img, idx }));
  let queueIndex = 0;

  async function processNext(): Promise<void> {
    while (queueIndex < queue.length) {
      const current = queue[queueIndex++];
      try {
        const result = await prepare(current.img, provider, options);
        results[current.idx] = result;
        totalTokens += result.tokens;
        if (result.cost !== undefined) {
          totalCost = (totalCost ?? 0) + result.cost;
        }
        totalOriginalBytes += result.original.bytes;
        totalOptimizedBytes += result.bytes;
        succeeded++;
      } catch (err) {
        if (!continueOnError) {
          throw err;
        }
        const batchError: BatchError = {
          index: current.idx,
          error: {
            code: 'PREPARE_FAILED',
            message: (err as Error).message,
          },
        };
        results[current.idx] = batchError;
        failed++;
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, images.length); i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);

  return {
    images: results,
    totalTokens,
    totalCost,
    totalOriginalBytes,
    totalOptimizedBytes,
    succeeded,
    failed,
  };
}

/**
 * Factory function that returns a pre-configured preparer instance.
 */
export function createPreparer(config: PreparerConfig): ImagePreparer {
  const { provider, ...defaultOptions } = config;

  return {
    async prepare(image: ImageSource, options?: PrepareOptions): Promise<PreparedImage> {
      return prepare(image, provider, { ...defaultOptions, ...options });
    },

    async prepareBatch(images: ImageSource[], options?: BatchPrepareOptions): Promise<BatchResult> {
      return prepareBatch(images, provider, { ...defaultOptions, ...options });
    },

    async estimateTokens(
      image: ImageSource | { width: number; height: number },
      options?: EstimateOptions,
    ): Promise<TokenEstimate> {
      return estimateTokens(image, provider, { ...defaultOptions, ...options });
    },
  };
}

// Re-export types used in ImageSource detection for testing
export { classifySource as _classifySource };
export type { ImageMimeType };
