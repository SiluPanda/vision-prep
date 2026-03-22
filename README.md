# vision-prep

Resize, optimize, and encode images for vision LLM APIs -- with provider-specific token estimation and ready-to-use content blocks for OpenAI, Anthropic, and Gemini.

[![npm version](https://img.shields.io/npm/v/vision-prep.svg)](https://www.npmjs.com/package/vision-prep)
[![license](https://img.shields.io/npm/l/vision-prep.svg)](https://github.com/SiluPanda/vision-prep/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/vision-prep.svg)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/vision-prep.svg)](https://www.npmjs.com/package/vision-prep)

---

## Description

Every major vision LLM provider has different image sizing rules, format requirements, file size limits, and token cost formulas. OpenAI divides images into 512x512 tiles and charges per tile. Anthropic scales images to fit within 1568px on the longest side and charges based on pixel count. Gemini charges a flat 258 tokens per image regardless of size.

`vision-prep` handles all of this in a single function call. Given an image source (file path, URL, Buffer, Uint8Array, or base64 string) and a target provider, it:

- Detects the image format from magic bytes (no file extension required)
- Extracts dimensions directly from image headers without full decode
- Validates format support and file size against provider constraints
- Computes the effective dimensions after provider-specific resize logic
- Encodes the image to base64
- Estimates the vision token cost using each provider's documented formula
- Returns a provider-formatted content block ready to embed in a messages array

Zero runtime dependencies. Pure Node.js. Full TypeScript support with strict mode.

---

## Installation

```bash
npm install vision-prep
```

Requires Node.js 18 or later.

---

## Quick Start

```typescript
import { prepare, estimateTokens, createPreparer } from 'vision-prep';

// Prepare an image for OpenAI (from a file path)
const result = await prepare('./photo.jpg', 'openai', { detail: 'high' });
console.log(result.tokens);       // 765
console.log(result.mimeType);     // 'image/jpeg'
console.log(result.contentBlock); // Ready for OpenAI messages array

// Estimate tokens without full processing
const estimate = await estimateTokens(
  { width: 1920, height: 1080 },
  'openai',
  { detail: 'high' },
);
console.log(estimate.tokens); // 1105

// Create a reusable preparer for Anthropic
const prep = createPreparer({ provider: 'anthropic' });
const anthropicResult = await prep.prepare(imageBuffer);
console.log(anthropicResult.contentBlock); // Ready for Anthropic messages array
```

---

## Features

- **Multi-provider support** -- OpenAI, Anthropic, and Gemini with provider-specific resize logic, token formulas, and content block formats.
- **Format detection from magic bytes** -- Identifies PNG, JPEG, GIF, WebP, and BMP from binary headers. No reliance on file extensions.
- **Header-only dimension extraction** -- Reads width and height from image headers (IHDR for PNG, SOF for JPEG, etc.) without decoding pixel data.
- **Accurate token estimation** -- Implements each provider's documented token formula: tile-based for OpenAI, pixel-based for Anthropic, flat rate for Gemini.
- **Provider-formatted content blocks** -- Returns content blocks in the exact structure each provider's API expects, ready for direct embedding in a messages array.
- **Flexible image sources** -- Accepts file paths, HTTP/HTTPS URLs, Buffers, Uint8Arrays, raw base64 strings, and data URLs.
- **Batch processing** -- Process multiple images in parallel with configurable concurrency and aggregate statistics.
- **Factory pattern** -- `createPreparer()` returns a pre-configured instance to avoid repeating provider and option arguments.
- **Zero runtime dependencies** -- Built entirely on Node.js built-in modules (`node:fs`, `node:path`, global `fetch`).
- **Full TypeScript** -- Strict mode, exported type definitions, declaration maps.

---

## API Reference

### `prepare(image, provider, options?)`

Prepare a single image for a vision LLM API. Detects format, extracts dimensions, validates against provider constraints, encodes to base64, estimates tokens, and returns a `PreparedImage` with a provider-formatted content block.

```typescript
function prepare(
  image: ImageSource,
  provider: Provider,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | `ImageSource` | File path, URL, Buffer, Uint8Array, base64 string, or data URL. |
| `provider` | `Provider` | Target provider: `'openai'`, `'anthropic'`, or `'gemini'`. |
| `options` | `PrepareOptions` | Optional configuration (see [PrepareOptions](#prepareoptions)). |

**Returns:** `Promise<PreparedImage>` -- see [PreparedImage](#preparedimage).

```typescript
import { prepare } from 'vision-prep';

// From a file path
const result = await prepare('./photo.jpg', 'openai', { detail: 'high' });

// From a URL
const result = await prepare('https://example.com/image.png', 'anthropic');

// From a Buffer
const result = await prepare(imageBuffer, 'gemini');

// From a data URL
const result = await prepare('data:image/jpeg;base64,/9j/4AAQ...', 'openai');
```

---

### `prepareForOpenAI(image, options?)`

Convenience wrapper equivalent to `prepare(image, 'openai', options)`.

```typescript
function prepareForOpenAI(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

---

### `prepareForAnthropic(image, options?)`

Convenience wrapper equivalent to `prepare(image, 'anthropic', options)`.

```typescript
function prepareForAnthropic(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

---

### `prepareForGemini(image, options?)`

Convenience wrapper equivalent to `prepare(image, 'gemini', options)`.

```typescript
function prepareForGemini(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

---

### `estimateTokens(image, provider, options?)`

Estimate vision token cost without full image preparation. Accepts either an image source (from which dimensions are extracted) or a `{ width, height }` object for direct calculation.

```typescript
function estimateTokens(
  image: ImageSource | { width: number; height: number },
  provider: Provider,
  options?: EstimateOptions,
): Promise<TokenEstimate>;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | `ImageSource \| { width: number; height: number }` | Image source or dimensions object. |
| `provider` | `Provider` | Target provider. |
| `options` | `EstimateOptions` | Optional. `detail` for OpenAI (`'low'`, `'high'`, `'auto'`), `model` for cost estimation. |

**Returns:** `Promise<TokenEstimate>` -- see [TokenEstimate](#tokenestimate).

```typescript
import { estimateTokens } from 'vision-prep';

// From dimensions (no I/O required)
const est = await estimateTokens({ width: 1024, height: 768 }, 'openai', { detail: 'high' });
console.log(est.tokens); // 765

// From a Buffer (reads dimensions from headers)
const est2 = await estimateTokens(imageBuffer, 'anthropic');
console.log(est2.tokens); // ceil(width * height / 750)
```

---

### `prepareBatch(images, provider, options?)`

Process multiple images in parallel with concurrency control and aggregate statistics.

```typescript
function prepareBatch(
  images: ImageSource[],
  provider: Provider,
  options?: BatchPrepareOptions,
): Promise<BatchResult>;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `images` | `ImageSource[]` | Array of image sources. |
| `provider` | `Provider` | Target provider. |
| `options` | `BatchPrepareOptions` | Optional. Includes `concurrency` (default: 4) and `continueOnError` (default: false). |

**Returns:** `Promise<BatchResult>` -- see [BatchResult](#batchresult).

```typescript
import { prepareBatch } from 'vision-prep';

const batch = await prepareBatch(
  [buffer1, buffer2, './photo.jpg'],
  'anthropic',
  { concurrency: 4, continueOnError: true },
);

console.log(batch.succeeded);         // 3
console.log(batch.failed);            // 0
console.log(batch.totalTokens);       // Aggregate across all images
console.log(batch.totalOriginalBytes);
console.log(batch.totalOptimizedBytes);
```

---

### `createPreparer(config)`

Factory function that returns a pre-configured `ImagePreparer` instance. Avoids repeating provider and option arguments across multiple calls.

```typescript
function createPreparer(config: PreparerConfig): ImagePreparer;
```

The returned `ImagePreparer` exposes three methods: `prepare`, `prepareBatch`, and `estimateTokens`. Options passed to individual method calls are merged with (and override) the config defaults.

```typescript
import { createPreparer } from 'vision-prep';

const prep = createPreparer({ provider: 'openai', detail: 'high' });

// Uses provider='openai' and detail='high' from config
const result = await prep.prepare(imageBuffer);

// Override detail for this specific call
const lowResult = await prep.prepare(imageBuffer, { detail: 'low' });
console.log(lowResult.tokens); // 85

// Batch processing with the same config
const batch = await prep.prepareBatch([buf1, buf2], { concurrency: 2 });

// Token estimation
const est = await prep.estimateTokens({ width: 1920, height: 1080 });
```

---

### `detectFormat(buffer)`

Detect image format from magic bytes. Supports PNG, JPEG, GIF, WebP (VP8, VP8L, VP8X), and BMP.

```typescript
function detectFormat(
  buffer: Buffer | Uint8Array,
): 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | null;
```

Returns `null` if the format cannot be identified.

---

### `extractDimensions(buffer, format)`

Extract image width and height from binary headers without full decode.

```typescript
function extractDimensions(
  buffer: Buffer | Uint8Array,
  format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp',
): { width: number; height: number } | null;
```

Returns `null` if dimensions cannot be extracted (e.g., truncated buffer).

---

### `getImageInfo(buffer)`

Detect format and extract full image metadata in one call. Throws if format is unrecognized or dimensions cannot be extracted.

```typescript
function getImageInfo(buffer: Buffer | Uint8Array): ImageInfo;
```

```typescript
import { getImageInfo } from 'vision-prep';

const info = getImageInfo(imageBuffer);
console.log(info.format);    // 'jpeg'
console.log(info.width);     // 1920
console.log(info.height);    // 1080
console.log(info.sizeBytes); // 245760
```

---

### `formatToMimeType(format)`

Convert a format string to its corresponding MIME type.

```typescript
function formatToMimeType(
  format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp',
): ImageMimeType;
```

| Input | Output |
|-------|--------|
| `'jpeg'` | `'image/jpeg'` |
| `'png'` | `'image/png'` |
| `'gif'` | `'image/gif'` |
| `'webp'` | `'image/webp'` |
| `'bmp'` | `'image/bmp'` |

---

### Token Estimation Functions

These lower-level functions compute token counts directly from dimensions, without any I/O.

#### `estimateOpenAITokens(width, height, detail?)`

```typescript
function estimateOpenAITokens(
  width: number,
  height: number,
  detail?: 'low' | 'high' | 'auto',
): number;
```

Returns 85 for `'low'` detail. For `'high'` (default), applies the resize logic (fit 2048x2048, then scale shortest side to 768px), then computes `ceil(w/512) * ceil(h/512) * 170 + 85`.

#### `estimateAnthropicTokens(width, height)`

```typescript
function estimateAnthropicTokens(width: number, height: number): number;
```

Applies Anthropic resize (longest side 1568px, max 1,568,000 pixels), then computes `ceil(width * height / 750)`.

#### `estimateGeminiTokens(width, height)`

```typescript
function estimateGeminiTokens(width: number, height: number): number;
```

Returns 258 regardless of dimensions.

#### `estimateTokensFromDimensions(width, height, provider, options?)`

```typescript
function estimateTokensFromDimensions(
  width: number,
  height: number,
  provider: Provider,
  options?: EstimateOptions,
): TokenEstimate;
```

Dispatches to the correct provider's token formula and returns a full `TokenEstimate` object.

---

### Resize Functions

These expose the provider-specific resize logic for inspection or custom pipelines.

#### `openAIHighDetailResize(width, height)`

```typescript
function openAIHighDetailResize(
  width: number,
  height: number,
): { width: number; height: number };
```

Step 1: Fit within 2048x2048. Step 2: Scale shortest side to 768px (only shrinks, never upscales).

#### `anthropicResize(width, height)`

```typescript
function anthropicResize(
  width: number,
  height: number,
): { width: number; height: number };
```

Step 1: Constrain longest side to 1568px. Step 2: Constrain total pixels to 1,568,000.

#### `getProviderResizedDimensions(width, height, provider, detail?)`

```typescript
function getProviderResizedDimensions(
  width: number,
  height: number,
  provider: Provider,
  detail?: 'low' | 'high' | 'auto',
): { width: number; height: number };
```

Returns the effective dimensions after applying provider-specific resize rules. OpenAI `'low'` detail fits within 512x512. Gemini fits within 3600x3600.

---

### Provider Content Block Formatters

#### `formatOpenAIContentBlock(base64, mimeType, detail?)`

```typescript
function formatOpenAIContentBlock(
  base64: string,
  mimeType: ImageMimeType,
  detail?: 'low' | 'high' | 'auto',
): OpenAIContentBlock;
```

Returns `{ type: 'image_url', image_url: { url: 'data:{mimeType};base64,{data}', detail } }`.

#### `formatAnthropicContentBlock(base64, mimeType)`

```typescript
function formatAnthropicContentBlock(
  base64: string,
  mimeType: ImageMimeType,
): AnthropicContentBlock;
```

Returns `{ type: 'image', source: { type: 'base64', media_type: '{mimeType}', data: '{base64}' } }`.

#### `formatGeminiContentBlock(base64, mimeType)`

```typescript
function formatGeminiContentBlock(
  base64: string,
  mimeType: ImageMimeType,
): GeminiContentBlock;
```

Returns `{ inlineData: { mimeType: '{mimeType}', data: '{base64}' } }`.

#### `formatContentBlock(provider, base64, mimeType, detail?)`

```typescript
function formatContentBlock(
  provider: Provider,
  base64: string,
  mimeType: ImageMimeType,
  detail?: 'low' | 'high' | 'auto',
): OpenAIContentBlock | AnthropicContentBlock | GeminiContentBlock;
```

Dispatches to the correct provider formatter.

---

### Provider Utility Functions

#### `getMaxFileSize(provider)`

```typescript
function getMaxFileSize(provider: Provider): number;
```

| Provider | Max file size |
|----------|--------------|
| `'openai'` | 20 MB (20,971,520 bytes) |
| `'anthropic'` | 5 MB (5,242,880 bytes) |
| `'gemini'` | 20 MB (20,971,520 bytes) |

#### `isFormatSupported(provider, format)`

```typescript
function isFormatSupported(provider: Provider, format: string): boolean;
```

| Provider | Supported formats |
|----------|------------------|
| `'openai'` | jpeg, png, gif, webp |
| `'anthropic'` | jpeg, png, gif, webp |
| `'gemini'` | jpeg, png, gif, webp, bmp |

---

## Configuration

### PrepareOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `detail` | `'low' \| 'high' \| 'auto'` | `'high'` | OpenAI detail mode. Only affects OpenAI provider. |
| `quality` | `number` | `85` | JPEG/WebP compression quality (1--100). |
| `format` | `'jpeg' \| 'png' \| 'webp'` | Input format | Output image format override. |
| `preferWebp` | `boolean` | `false` | Prefer WebP output for smaller file size. |
| `maxWidth` | `number` | -- | Custom maximum width. Provider constraints still apply as ceiling. |
| `maxHeight` | `number` | -- | Custom maximum height. Provider constraints still apply as ceiling. |
| `model` | `string` | -- | Model identifier for USD cost estimation (e.g., `'gpt-4o'`). |
| `stripMetadata` | `boolean` | `true` | Strip EXIF metadata from the image. |
| `fetchTimeout` | `number` | `30000` | Timeout in milliseconds for URL fetching. |
| `signal` | `AbortSignal` | -- | AbortSignal for cancellation support. |

### BatchPrepareOptions

Extends `PrepareOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `4` | Maximum number of images to process concurrently. |
| `continueOnError` | `boolean` | `false` | If true, continue processing remaining images when one fails. |

### EstimateOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `detail` | `'low' \| 'high' \| 'auto'` | `'high'` | OpenAI detail mode. |
| `model` | `string` | -- | Model identifier for USD cost estimation. |

### PreparerConfig

Extends `PrepareOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `Provider` | (required) | Target provider: `'openai'`, `'anthropic'`, or `'gemini'`. |

---

## Error Handling

`vision-prep` throws standard `Error` instances with descriptive messages. Errors are thrown in these situations:

### Unrecognized image format

Thrown by `getImageInfo` and `prepare` when the image buffer does not match any known format signature.

```
Error: Unrecognized image format: could not detect format from magic bytes
```

### Unsupported format for provider

Thrown when the detected format is not supported by the target provider (e.g., BMP on OpenAI or Anthropic).

```
Error: Format 'bmp' is not supported by openai. Supported formats: jpeg, png, gif, webp
```

### File size exceeds provider limit

Thrown when the image exceeds the provider's maximum file size.

```
Error: Image size (25000000 bytes) exceeds openai limit of 20971520 bytes (20 MB)
```

### Image file not found

Thrown when a file path is provided but the file does not exist.

```
Error: Image not found: /path/to/missing.jpg
```

### Failed to read image file

Thrown on file I/O errors other than ENOENT.

```
Error: Failed to read image file: <system error message>
```

### URL fetch errors

Thrown when fetching an image from a URL fails.

```
Error: Failed to fetch image: HTTP 404
Error: Image fetch timed out after 30000ms
```

### Invalid data URL

Thrown when a data URL string is malformed.

```
Error: Invalid data URL: missing comma separator
```

### Dimension extraction failure

Thrown by `getImageInfo` when format is detected but the buffer is too short to read dimensions.

```
Error: Could not extract dimensions from jpeg image
```

### Batch errors

When `continueOnError` is true, failed images are represented as `BatchError` objects in the results array instead of throwing:

```typescript
interface BatchError {
  index: number;
  error: {
    code: string;   // 'PREPARE_FAILED'
    message: string;
  };
}
```

When `continueOnError` is false (default), the first error encountered causes the entire batch to reject.

---

## Advanced Usage

### Multi-provider comparison

Prepare the same image for multiple providers to compare token costs:

```typescript
import { estimateTokens } from 'vision-prep';

const dims = { width: 1920, height: 1080 };

const openai = await estimateTokens(dims, 'openai', { detail: 'high' });
const anthropic = await estimateTokens(dims, 'anthropic');
const gemini = await estimateTokens(dims, 'gemini');

console.log(`OpenAI:    ${openai.tokens} tokens (${openai.width}x${openai.height})`);
console.log(`Anthropic: ${anthropic.tokens} tokens (${anthropic.width}x${anthropic.height})`);
console.log(`Gemini:    ${gemini.tokens} tokens (${gemini.width}x${gemini.height})`);
// OpenAI:    1105 tokens (1365x768)
// Anthropic: 1844 tokens (1568x882)
// Gemini:    258 tokens (1920x1080)
```

### Custom dimension constraints

Apply your own dimension limits on top of provider constraints:

```typescript
import { prepare } from 'vision-prep';

const result = await prepare(largeImage, 'openai', {
  detail: 'high',
  maxWidth: 800,
  maxHeight: 600,
});
// Dimensions are constrained to at most 800x600,
// then further constrained by OpenAI's resize rules.
```

### Cancellation with AbortSignal

Cancel URL-based image fetching with an AbortSignal:

```typescript
import { prepare } from 'vision-prep';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const result = await prepare('https://example.com/large-image.jpg', 'openai', {
    signal: controller.signal,
    fetchTimeout: 10000,
  });
} catch (err) {
  console.error('Fetch cancelled or timed out:', err.message);
}
```

### Batch processing with error tolerance

Process a batch of images, collecting errors without stopping the pipeline:

```typescript
import { prepareBatch } from 'vision-prep';

const result = await prepareBatch(imageBuffers, 'anthropic', {
  concurrency: 8,
  continueOnError: true,
});

for (const item of result.images) {
  if ('error' in item) {
    console.error(`Image ${item.index} failed: ${item.error.message}`);
  } else {
    console.log(`Image prepared: ${item.width}x${item.height}, ${item.tokens} tokens`);
  }
}

console.log(`${result.succeeded}/${result.images.length} succeeded`);
console.log(`Total tokens: ${result.totalTokens}`);
```

### Using content blocks directly in API calls

The `contentBlock` property of `PreparedImage` is formatted for direct use in provider SDK calls:

```typescript
import { prepareForOpenAI } from 'vision-prep';

const image = await prepareForOpenAI(buffer, { detail: 'high' });

// Use directly in OpenAI API call
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        image.contentBlock, // { type: 'image_url', image_url: { url: '...', detail: 'high' } }
      ],
    },
  ],
});
```

```typescript
import { prepareForAnthropic } from 'vision-prep';

const image = await prepareForAnthropic(buffer);

// Use directly in Anthropic API call
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages: [
    {
      role: 'user',
      content: [
        image.contentBlock, // { type: 'image', source: { type: 'base64', ... } }
        { type: 'text', text: 'Describe this image.' },
      ],
    },
  ],
});
```

---

## Token Formulas

Each provider uses a different formula to calculate vision token costs.

### OpenAI

| Detail mode | Formula |
|-------------|---------|
| `'low'` | 85 tokens (flat) |
| `'high'` | Fit within 2048x2048, then scale shortest side to 768px. Tile into 512x512 patches: `ceil(w/512) * ceil(h/512) * 170 + 85` |

Examples at `detail: 'high'`:

| Input | After resize | Tiles | Tokens |
|-------|-------------|-------|--------|
| 512x512 | 512x512 | 1x1 | 255 |
| 1024x768 | 1024x768 | 2x2 | 765 |
| 1920x1080 | 1365x768 | 3x2 | 1105 |
| 4000x3000 | 1024x768 | 2x2 | 765 |

### Anthropic

Constrain longest side to 1568px, then constrain total pixels to 1,568,000. Token count: `ceil(width * height / 750)`.

| Input | After resize | Tokens |
|-------|-------------|--------|
| 256x256 | 256x256 | 88 |
| 1024x768 | 1024x768 | 1049 |
| 1920x1080 | 1568x882 | 1844 |

### Gemini

Flat rate: 258 tokens per image, regardless of dimensions.

---

## TypeScript

`vision-prep` is written in TypeScript with strict mode enabled. All public types are exported:

```typescript
import type {
  ImageSource,
  Provider,
  ImageMimeType,
  ImageInfo,
  PrepareOptions,
  OpenAIPrepareOptions,
  EstimateOptions,
  BatchPrepareOptions,
  PreparerConfig,
  PreparedImage,
  TokenEstimate,
  BatchResult,
  BatchError,
  OpenAIContentBlock,
  AnthropicContentBlock,
  GeminiContentBlock,
  ImagePreparer,
} from 'vision-prep';
```

### Key types

```typescript
type ImageSource = string | Buffer | Uint8Array;

type Provider = 'openai' | 'anthropic' | 'gemini';

type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp';

interface ImageInfo {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp';
  sizeBytes: number;
}

interface PreparedImage {
  base64: string;
  mimeType: ImageMimeType;
  width: number;
  height: number;
  tokens: number;
  cost?: number;
  bytes: number;
  original: {
    width: number;
    height: number;
    bytes: number;
    mimeType: ImageMimeType;
  };
  contentBlock: OpenAIContentBlock | AnthropicContentBlock | GeminiContentBlock;
  provider: Provider;
  detail?: 'low' | 'high';
}

interface TokenEstimate {
  tokens: number;
  cost?: number;
  width: number;
  height: number;
  provider: Provider;
}

interface BatchResult {
  images: Array<PreparedImage | BatchError>;
  totalTokens: number;
  totalCost?: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  succeeded: number;
  failed: number;
}

interface ImagePreparer {
  prepare(image: ImageSource, options?: PrepareOptions): Promise<PreparedImage>;
  prepareBatch(images: ImageSource[], options?: BatchPrepareOptions): Promise<BatchResult>;
  estimateTokens(
    image: ImageSource | { width: number; height: number },
    options?: EstimateOptions,
  ): Promise<TokenEstimate>;
}
```

---

## License

MIT
