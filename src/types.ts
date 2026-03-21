// ── Source and Provider ──────────────────────────────────────────────

/** Image input: file path, URL, Buffer, Uint8Array, or base64 string. */
export type ImageSource = string | Buffer | Uint8Array;

/** Supported vision LLM providers. */
export type Provider = 'openai' | 'anthropic' | 'gemini';

/** Supported image MIME types. */
export type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp';

/** Detected image format info (without full decode). */
export interface ImageInfo {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp';
  sizeBytes: number;
}

// ── Options ─────────────────────────────────────────────────────────

export interface PrepareOptions {
  /** OpenAI detail mode. Only applies to OpenAI provider. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';

  /** JPEG/WebP compression quality (1-100). Default: 85. */
  quality?: number;

  /** Output image format. If not specified, uses the input format. */
  format?: 'jpeg' | 'png' | 'webp';

  /** Prefer WebP output for smaller file size. Default: false. */
  preferWebp?: boolean;

  /** Override maximum width. Provider constraints still apply as ceiling. */
  maxWidth?: number;

  /** Override maximum height. Provider constraints still apply as ceiling. */
  maxHeight?: number;

  /** Model identifier for dollar cost estimation (e.g., 'gpt-4o'). */
  model?: string;

  /** Strip EXIF metadata. Default: true. */
  stripMetadata?: boolean;

  /** Timeout for URL fetching in milliseconds. Default: 30_000. */
  fetchTimeout?: number;

  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface OpenAIPrepareOptions extends PrepareOptions {
  /** OpenAI detail mode. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';
}

export interface EstimateOptions {
  /** OpenAI detail mode. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';

  /** Model identifier for dollar cost estimation. */
  model?: string;
}

export interface BatchPrepareOptions extends PrepareOptions {
  /** Maximum number of images to process concurrently. Default: 4. */
  concurrency?: number;

  /** If true, continue processing remaining images when one fails. Default: false. */
  continueOnError?: boolean;
}

export interface PreparerConfig extends PrepareOptions {
  /** Target provider. Required. */
  provider: Provider;
}

// ── Results ─────────────────────────────────────────────────────────

export interface PreparedImage {
  /** Base64-encoded image data (no data URL prefix). */
  base64: string;

  /** MIME type of the encoded image. */
  mimeType: ImageMimeType;

  /** Width of the prepared image in pixels. */
  width: number;

  /** Height of the prepared image in pixels. */
  height: number;

  /** Estimated vision token count for the target provider. */
  tokens: number;

  /** Estimated cost in USD. Undefined if no model was specified. */
  cost?: number;

  /** Size of the optimized image in bytes. */
  bytes: number;

  /** Original image metadata (before processing). */
  original: {
    width: number;
    height: number;
    bytes: number;
    mimeType: ImageMimeType;
  };

  /** Provider-formatted content block, ready to embed in a messages array. */
  contentBlock: OpenAIContentBlock | AnthropicContentBlock | GeminiContentBlock;

  /** The provider this image was prepared for. */
  provider: Provider;

  /** The detail mode used (OpenAI only). */
  detail?: 'low' | 'high';
}

export interface TokenEstimate {
  /** Estimated vision token count. */
  tokens: number;

  /** Estimated cost in USD. Undefined if no model specified. */
  cost?: number;

  /** Image dimensions used for the calculation (after provider resize). */
  width: number;
  height: number;

  /** The provider the estimate is for. */
  provider: Provider;
}

export interface BatchResult {
  /** Prepared images, in the same order as the input array. */
  images: Array<PreparedImage | BatchError>;

  /** Total token count across all successfully prepared images. */
  totalTokens: number;

  /** Total cost across all successfully prepared images. */
  totalCost?: number;

  /** Total original bytes across all images. */
  totalOriginalBytes: number;

  /** Total optimized bytes across all successfully prepared images. */
  totalOptimizedBytes: number;

  /** Number of images that were successfully prepared. */
  succeeded: number;

  /** Number of images that failed. */
  failed: number;
}

export interface BatchError {
  /** The index of the failed image in the input array. */
  index: number;

  /** Error details. */
  error: {
    code: string;
    message: string;
  };
}

// ── Provider Content Blocks ─────────────────────────────────────────

export interface OpenAIContentBlock {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface AnthropicContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface GeminiContentBlock {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

// ── Preparer Interface ──────────────────────────────────────────────

export interface ImagePreparer {
  prepare(image: ImageSource, options?: PrepareOptions): Promise<PreparedImage>;
  prepareBatch(images: ImageSource[], options?: BatchPrepareOptions): Promise<BatchResult>;
  estimateTokens(
    image: ImageSource | { width: number; height: number },
    options?: EstimateOptions,
  ): Promise<TokenEstimate>;
}
