# vision-prep -- Task Breakdown

This file tracks all implementation tasks derived from `SPEC.md`. Each task is granular, actionable, and maps to a specific feature, requirement, or edge case from the spec.

---

## Phase 1: Project Setup and Scaffolding

- [ ] **Install dev dependencies** -- Add `typescript`, `vitest`, `eslint`, and `sharp` as dev dependencies. Add `@types/node` for Node.js type definitions. | Status: not_done
- [ ] **Configure peer dependencies** -- Add `sharp` (>=0.33.0) as an optional peer dependency in `package.json`. Add `model-price-registry` (^1.0.0) as an optional dependency. Configure `peerDependenciesMeta` to mark `sharp` as optional. | Status: not_done
- [ ] **Add CLI bin entry** -- Add `"bin": { "vision-prep": "./dist/cli.js" }` to `package.json` for the CLI binary. | Status: not_done
- [ ] **Create file structure** -- Create all directories and empty source files matching the spec's file structure: `src/pipeline/`, `src/providers/`, `src/backends/`, `src/__tests__/`, `src/__tests__/fixtures/`. | Status: not_done
- [ ] **Create test fixtures** -- Generate minimal valid test image files: `photo.jpg` (4000x3000 JPEG), `icon.png` (64x64 PNG), `screenshot.png` (1920x1080 PNG), `small.webp` (256x256 WebP), `diagram.bmp` (800x600 BMP), `corrupted.jpg` (invalid JPEG data). Keep them as small as possible (valid headers with minimal pixel data). | Status: not_done

---

## Phase 2: Types and Error Definitions

- [x] **Define ImageSource type** -- Create `src/types.ts` with the `ImageSource` union type: `string | Buffer | Uint8Array`. | Status: done
- [x] **Define Provider type** -- Add `Provider` type as `'openai' | 'anthropic' | 'gemini'`. | Status: done
- [x] **Define ImageMimeType type** -- Add `ImageMimeType` type covering `'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/bmp'`. | Status: done
- [x] **Define PrepareOptions interface** -- Add the `PrepareOptions` interface with all fields: `detail`, `quality`, `format`, `preferWebp`, `maxWidth`, `maxHeight`, `model`, `stripMetadata`, `backend`, `fetchTimeout`, `signal`. Include JSDoc comments and defaults per spec. | Status: done
- [x] **Define OpenAIPrepareOptions interface** -- Add `OpenAIPrepareOptions` extending `PrepareOptions` with the `detail` field. | Status: done
- [x] **Define EstimateOptions interface** -- Add `EstimateOptions` with `detail` and `model` fields. | Status: done
- [x] **Define BatchPrepareOptions interface** -- Add `BatchPrepareOptions` extending `PrepareOptions` with `concurrency` and `continueOnError` fields. | Status: done
- [x] **Define PreparerConfig interface** -- Add `PreparerConfig` extending `PrepareOptions` with required `provider` field. | Status: done
- [x] **Define PreparedImage interface** -- Add the `PreparedImage` interface with all fields: `base64`, `mimeType`, `width`, `height`, `tokens`, `cost`, `bytes`, `original` (nested object with `width`, `height`, `bytes`, `mimeType`), `contentBlock`, `provider`, `detail`. | Status: done
- [x] **Define TokenEstimate interface** -- Add `TokenEstimate` with `tokens`, `cost`, `width`, `height`, `provider`. | Status: done
- [x] **Define BatchResult interface** -- Add `BatchResult` with `images`, `totalTokens`, `totalCost`, `totalOriginalBytes`, `totalOptimizedBytes`, `succeeded`, `failed`. | Status: done
- [x] **Define BatchError interface** -- Add `BatchError` with `index` and `error` (nested `code` and `message`). | Status: done
- [x] **Define OpenAIContentBlock interface** -- Add with `type: 'image_url'` and nested `image_url` object containing `url` and optional `detail`. | Status: done
- [x] **Define AnthropicContentBlock interface** -- Add with `type: 'image'` and nested `source` object containing `type: 'base64'`, `media_type`, `data`. | Status: done
- [x] **Define GeminiContentBlock interface** -- Add with `inlineData` object containing `mimeType` and `data`. | Status: done
- [x] **Define ImagePreparer interface** -- Add with `prepare`, `prepareBatch`, and `estimateTokens` methods. | Status: done
- [x] **Export all types** -- Export all types from `src/types.ts` using `export type {}`. | Status: done
- [ ] **Create error classes** -- Create `src/errors.ts` with custom error classes: `ImageNotFoundError`, `InvalidImageError`, `ImageTooLargeError`, `UnsupportedProviderError`, `InvalidBase64Error`, `ImageFetchError`. Each should extend `Error` with a descriptive `code` property and `name` set to the class name. | Status: not_done

---

## Phase 3: Provider Modules

### OpenAI Provider (`src/providers/openai.ts`)

- [x] **Implement OpenAI low-detail resize** -- Implement `resizeForOpenAILow(width, height)` that fits the image within 512x512, preserving aspect ratio, never upscaling. Return `(width, height)` unchanged if already fits. | Status: done
- [x] **Implement OpenAI high-detail resize** -- Implement `resizeForOpenAIHigh(width, height)`: Step 1 constrains to 2048x2048; Step 2 scales shortest side to at most 768px. Never upscale. Use `Math.round` for dimension calculations. | Status: done
- [x] **Implement OpenAI token estimation** -- Implement tile-based formula: low detail returns flat 85; high detail computes `ceil(w/512) * ceil(h/512) * 170 + 85` after resize. Handle `auto` detail mode (treat as high). | Status: done
- [x] **Implement OpenAI content block formatter** -- Generate `{ type: 'image_url', image_url: { url: 'data:{mimeType};base64,{data}', detail } }`. The `url` field must include the full data URL prefix. | Status: done

### Anthropic Provider (`src/providers/anthropic.ts`)

- [x] **Implement Anthropic resize** -- Implement `resizeForAnthropic(width, height)`: Step 1 constrains longest side to 1568px; Step 2 constrains total pixel count to 1,568,000. Use `Math.sqrt` for pixel count scaling. Never upscale. | Status: done
- [x] **Implement Anthropic token estimation** -- Implement `ceil(width * height / 750)` formula applied after resize dimensions are calculated. | Status: done
- [x] **Implement Anthropic content block formatter** -- Generate `{ type: 'image', source: { type: 'base64', media_type: '{mimeType}', data: '{base64}' } }`. The `data` field is raw base64 without any prefix. The `media_type` must be the full MIME type string. | Status: done

### Gemini Provider (`src/providers/gemini.ts`)

- [x] **Implement Gemini resize** -- Implement `resizeForGemini(width, height)` that fits the image within 3600x3600, preserving aspect ratio. Never upscale. | Status: done
- [x] **Implement Gemini token estimation** -- Return flat 258 tokens regardless of dimensions. | Status: done
- [x] **Implement Gemini content block formatter** -- Generate `{ inlineData: { mimeType: '{mimeType}', data: '{base64}' } }`. The `data` field is raw base64 without prefix. | Status: done

### Provider Registry

- [x] **Create provider lookup** -- Implement a function/map that returns the correct resize, token estimation, and content block functions for a given `Provider` string. Throw `UnsupportedProviderError` for unknown providers. | Status: done
- [x] **Define provider constraints** -- Create a constants/config for each provider: max file size (OpenAI 20MB, Anthropic 5MB, Gemini 20MB), max dimensions, supported formats. | Status: done

---

## Phase 4: Image Pipeline

### Step 1: Read Image (`src/pipeline/read.ts`)

- [x] **Detect image source type from string** -- Implement string inspection logic: `http://`/`https://` prefix = URL; `data:` prefix = base64 data URL; base64-valid characters with length > 260 = raw base64; everything else = file path. | Status: done
- [x] **Read image from file path** -- Use `fs.readFile()` to read the file. Throw `ImageNotFoundError` if file does not exist. | Status: done
- [x] **Read image from URL** -- Use `fetch()` to download the image. Follow redirects. Validate response is 2xx and has image content type. Respect configurable timeout (default 30s). Support `AbortSignal` for cancellation. Throw `ImageFetchError` on failure. | Status: done
- [x] **Read image from Buffer/Uint8Array** -- Accept and use as-is without any transformation. | Status: done
- [x] **Read image from base64 string** -- Strip data URL prefix (`data:image/...;base64,`) if present. Decode base64 to Buffer. Throw `InvalidBase64Error` if decoding fails. Parse MIME type from data URL prefix when available. | Status: done

### Step 2: Detect Format and Dimensions (`src/pipeline/detect.ts`)

- [x] **Detect image format from magic bytes** -- Implement magic byte inspection for JPEG (FF D8 FF), PNG (89 50 4E 47), GIF (47 49 46 38), WebP (52 49 46 46 ... 57 45 42 50), BMP (42 4D). Detect format from buffer header, not file extension. | Status: done
- [x] **Extract image dimensions** -- Use the image processing backend's metadata function (e.g., `sharp(buffer).metadata()`) to extract width and height without fully decoding the image. | Status: done
- [x] **Validate format for provider** -- Check if the detected format is supported by the target provider. Mark for conversion if not (e.g., BMP on OpenAI/Anthropic). Throw `InvalidImageError` for corrupted or unreadable images. | Status: done

### Step 3: Resize (`src/pipeline/resize.ts`)

- [ ] **Implement provider-specific resize dispatch** -- Route to the correct provider resize function based on the `Provider` value and options (e.g., OpenAI + detail mode). | Status: not_done
- [ ] **Apply custom dimension overrides** -- When `maxWidth`/`maxHeight` are specified, apply them first, then apply provider constraints as a ceiling (use the smaller of custom and provider dimensions). | Status: not_done
- [ ] **Enforce no-upscale invariant** -- Clamp the scale factor to `min(scale, 1)` in all resize paths. Images already within bounds are returned unchanged. | Status: not_done
- [ ] **Preserve aspect ratio** -- All resize operations must maintain the original aspect ratio. Use `fit: 'inside'` strategy. | Status: not_done
- [ ] **Perform actual resize via backend** -- Call the image processing backend to perform the physical resize operation (sharp or jimp). | Status: not_done

### Step 4: Optimize (`src/pipeline/optimize.ts`)

- [ ] **Implement JPEG compression** -- Apply configurable quality (default 85, range 1-100). Strip EXIF metadata when `stripMetadata: true` (default). | Status: not_done
- [ ] **Implement PNG compression** -- Apply compression level (default 6, range 0-9). Use adaptive filtering. | Status: not_done
- [ ] **Implement WebP compression** -- Apply configurable quality (default 85). | Status: not_done
- [ ] **Handle GIF pass-through** -- Pass GIF images through without recompression. | Status: not_done
- [ ] **Implement format conversion** -- Convert BMP to JPEG when provider does not support BMP. Convert to specified `options.format` when set. Convert to WebP when `options.preferWebp` is true and provider supports WebP. | Status: not_done
- [ ] **Implement iterative quality reduction for file size limits** -- If compressed image exceeds provider file size limit, reduce quality iteratively (steps: 85, 75, 65, 55, 45, 35, 25, 20). For PNG exceeding limits, convert to JPEG then iterate. Throw `ImageTooLargeError` if image cannot fit at minimum quality. | Status: not_done
- [ ] **Implement format selection logic** -- When no format specified: keep input format if provider supports it; convert BMP to JPEG for non-Gemini; respect `preferWebp`; otherwise keep input format. Do not convert between JPEG and PNG unless explicitly requested. | Status: not_done

### Step 5: Encode (`src/pipeline/encode.ts`)

- [x] **Base64 encode** -- Convert optimized image Buffer to base64 string using `buffer.toString('base64')`. Return raw base64 (no data URL prefix). | Status: done

### Step 6: Token Cost Estimation (`src/pipeline/tokens.ts`)

- [x] **Dispatch to provider token formula** -- Route to the correct provider's token estimation function based on the `Provider` value. Pass final resized dimensions (after Step 3). | Status: done
- [ ] **Implement dollar cost calculation** -- When a model identifier is provided, look up input pricing from `model-price-registry` (optional dependency). Calculate `cost = tokens / 1_000_000 * inputPricePerMTok`. Return `undefined` for cost if registry is not installed or model not found. | Status: not_done
- [ ] **Handle model-price-registry absence gracefully** -- Use dynamic `require`/`import` with try/catch. When absent, log a warning (not an error) and set `cost` to `undefined`. | Status: not_done

---

## Phase 5: Core API Functions

### `prepare()` (`src/prepare.ts`)

- [x] **Implement prepare() function** -- Orchestrate the full seven-step pipeline: read, detect, resize, optimize, encode, estimate tokens, assemble PreparedImage. Accept `ImageSource`, `Provider`, and optional `PrepareOptions`. Return `Promise<PreparedImage>`. | Status: done
- [x] **Assemble PreparedImage result** -- Populate all fields: `base64`, `mimeType`, `width`, `height`, `tokens`, `cost`, `bytes`, `original` (original dimensions and byte size), `contentBlock` (formatted for provider), `provider`, `detail` (OpenAI only). | Status: done
- [x] **Implement prepareForOpenAI()** -- Convenience wrapper calling `prepare(image, 'openai', options)`. Accept `OpenAIPrepareOptions`. | Status: done
- [x] **Implement prepareForAnthropic()** -- Convenience wrapper calling `prepare(image, 'anthropic', options)`. | Status: done
- [x] **Implement prepareForGemini()** -- Convenience wrapper calling `prepare(image, 'gemini', options)`. | Status: done

### `estimateTokens()` (`src/estimate.ts`)

- [x] **Implement estimateTokens() with dimensions input** -- Accept `{ width, height }` object directly. Calculate provider resize dimensions and token count without reading/processing an image. Return `TokenEstimate`. | Status: done
- [x] **Implement estimateTokens() with image source input** -- Accept `ImageSource`, read the image to extract dimensions (using detect step only), then calculate token count. Return `TokenEstimate`. | Status: done
- [x] **Support EstimateOptions** -- Handle `detail` (for OpenAI) and `model` (for dollar cost estimation) options. | Status: done

### `prepareBatch()` (`src/batch.ts`)

- [x] **Implement prepareBatch()** -- Process an array of `ImageSource` items in parallel. Use a semaphore pattern to enforce the `concurrency` limit (default 4). Return `BatchResult`. | Status: done
- [x] **Aggregate batch statistics** -- Calculate `totalTokens`, `totalCost`, `totalOriginalBytes`, `totalOptimizedBytes`, `succeeded`, `failed` across all results. | Status: done
- [x] **Implement continueOnError behavior** -- When `continueOnError: false` (default), reject the promise on first failure. When `true`, catch individual errors, record them as `BatchError` objects, and continue processing remaining images. | Status: done
- [x] **Preserve result order** -- Return results in the same order as the input array, regardless of processing order. | Status: done

### `createPreparer()` (`src/factory.ts`)

- [x] **Implement createPreparer()** -- Accept `PreparerConfig` (which includes `provider` and all `PrepareOptions` fields). Return an `ImagePreparer` object. | Status: done
- [x] **Implement ImagePreparer.prepare()** -- Merge pre-configured options with per-call options (per-call overrides pre-configured). Call the underlying `prepare()` function with the merged options and pre-configured provider. | Status: done
- [x] **Implement ImagePreparer.prepareBatch()** -- Merge pre-configured options with per-call batch options. Call the underlying `prepareBatch()`. | Status: done
- [x] **Implement ImagePreparer.estimateTokens()** -- Merge pre-configured options with per-call estimate options. Call the underlying `estimateTokens()`. | Status: done

---

## Phase 6: Image Processing Backends

### Sharp Backend (`src/backends/sharp.ts`)

- [ ] **Implement sharp metadata extraction** -- Wrap `sharp(buffer).metadata()` to return format, width, height. | Status: not_done
- [ ] **Implement sharp resize** -- Wrap `sharp(buffer).resize(width, height, { fit: 'inside', withoutEnlargement: true })`. | Status: not_done
- [ ] **Implement sharp JPEG compression** -- Wrap `.jpeg({ quality, mozjpeg: true })` with EXIF stripping via `.rotate()` (auto-orient then strip). | Status: not_done
- [ ] **Implement sharp PNG compression** -- Wrap `.png({ compressionLevel })`. | Status: not_done
- [ ] **Implement sharp WebP compression** -- Wrap `.webp({ quality })`. | Status: not_done
- [ ] **Implement sharp format conversion** -- Wrap `.toFormat(format)` for BMP-to-JPEG, JPEG-to-WebP, etc. | Status: not_done
- [ ] **Implement sharp GIF handling** -- Pass GIF through or extract first frame for providers that need it. | Status: not_done

### Jimp Backend (`src/backends/jimp.ts`)

- [ ] **Implement jimp metadata extraction** -- Read image with jimp, extract format, width, height. | Status: not_done
- [ ] **Implement jimp resize** -- Use jimp's resize method with `RESIZE_BILINEAR` or equivalent. Enforce no-upscale. | Status: not_done
- [ ] **Implement jimp compression** -- Apply JPEG quality, PNG compression via jimp methods. | Status: not_done
- [ ] **Implement jimp format conversion** -- Convert between formats using jimp's output methods. | Status: not_done

### Backend Selection

- [ ] **Implement backend detection and fallback** -- Try to load `sharp` first. If unavailable, fall back to jimp (if specified via `backend: 'jimp'`). If neither is available, use a minimal built-in reader that can detect format and dimensions but cannot resize/compress. Log a warning in fallback mode. | Status: not_done
- [ ] **Implement fallback-mode behavior** -- When no backend can resize, skip resize and compression steps. Encode raw image to base64. Log a warning that the image was not optimized. | Status: not_done

---

## Phase 7: CLI

### CLI Argument Parsing (`src/cli.ts`)

- [ ] **Implement CLI entry point** -- Create `src/cli.ts` with `#!/usr/bin/env node` shebang. Use `util.parseArgs` (Node.js 18+ built-in) for argument parsing. No external CLI libraries. | Status: not_done
- [ ] **Parse `prepare` command** -- Parse `vision-prep prepare <provider> <image>` with options: `--detail`, `--quality`, `--format`, `--max-width`, `--max-height`, `--model`, `--output`, `--base64`, `--json`, `--quiet`. | Status: not_done
- [ ] **Parse `batch` command** -- Parse `vision-prep batch <provider> <images...>` with options: `--concurrency`, `--continue-on-error`, `--output-dir`, `--json`, plus all `prepare` options. | Status: not_done
- [ ] **Parse `estimate` command** -- Parse `vision-prep estimate <provider> <image>` with options: `--dimensions` (WxH format), `--detail`, `--model`, `--json`. | Status: not_done
- [ ] **Implement --version flag** -- Read version from `package.json` and print it. | Status: not_done
- [ ] **Implement --help flag** -- Print usage information for each command with all options documented. | Status: not_done
- [ ] **Validate CLI arguments** -- Validate provider is one of `openai`, `anthropic`, `gemini`. Validate required arguments are present. Print clear error messages for invalid input. | Status: not_done

### CLI Output Formatting

- [ ] **Implement human-readable output for prepare** -- Format output as shown in spec: provider, model, original vs prepared dimensions, file size reduction percentage, tokens, cost. | Status: not_done
- [ ] **Implement JSON output for prepare** -- Output the full `PreparedImage` object as formatted JSON when `--json` is used. | Status: not_done
- [ ] **Implement base64 output** -- Output raw base64 string to stdout when `--base64` is used. | Status: not_done
- [ ] **Implement --output file writing** -- Write the optimized image binary to the specified file path instead of stdout. | Status: not_done
- [ ] **Implement human-readable output for estimate** -- Format provider, dimensions before/after resize, token count, and optional cost. | Status: not_done
- [ ] **Implement JSON output for batch** -- Output the full `BatchResult` as formatted JSON. | Status: not_done
- [ ] **Implement --output-dir for batch** -- Write each optimized image to the specified directory, preserving original filenames. | Status: not_done
- [ ] **Implement --quiet mode** -- Suppress all output except errors. | Status: not_done

### CLI Exit Codes

- [ ] **Implement exit code 0** -- Return 0 on successful prepare, batch, or estimate. | Status: not_done
- [ ] **Implement exit code 1** -- Return 1 on processing errors (image read/decode/process failures). | Status: not_done
- [ ] **Implement exit code 2** -- Return 2 on configuration errors (invalid flags, missing arguments, unsupported provider). | Status: not_done

---

## Phase 8: Public API Exports

- [x] **Set up index.ts exports** -- Export all public API functions from `src/index.ts`: `prepare`, `prepareForOpenAI`, `prepareForAnthropic`, `prepareForGemini`, `estimateTokens`, `prepareBatch`, `createPreparer`. | Status: done
- [x] **Export all types** -- Re-export all type definitions from `src/types.ts` via `src/index.ts`. | Status: done
- [ ] **Export error classes** -- Re-export all custom error classes from `src/errors.ts` via `src/index.ts`. | Status: not_done

---

## Phase 9: Unit Tests

### Image Source Detection Tests (`src/__tests__/read.test.ts`)

- [x] **Test file path detection** -- Verify absolute paths, relative paths, and paths with spaces are correctly identified as file paths. | Status: done
- [x] **Test URL detection** -- Verify strings starting with `http://` and `https://` are correctly identified as URLs. | Status: done
- [x] **Test data URL detection** -- Verify strings starting with `data:image/` are correctly identified as base64 data URLs. | Status: done
- [x] **Test raw base64 detection** -- Verify long base64 strings (length > 260) without prefix are correctly identified as raw base64. | Status: done
- [x] **Test short strings treated as file paths** -- Verify short strings that look like base64 are treated as file paths, not base64. | Status: done
- [x] **Test Buffer and Uint8Array acceptance** -- Verify Buffer and Uint8Array inputs are accepted without detection logic. | Status: done
- [x] **Test file not found error** -- Verify `ImageNotFoundError` is thrown for non-existent file paths. | Status: done
- [ ] **Test invalid base64 error** -- Verify `InvalidBase64Error` is thrown for invalid base64 strings. | Status: not_done

### Resize Calculation Tests (`src/__tests__/resize.test.ts`)

- [x] **Test OpenAI low detail resize** -- Verify various input sizes produce dimensions within 512x512. Test edge cases: exactly 512x512, smaller than 512x512, much larger. | Status: done
- [x] **Test OpenAI high detail resize -- 4000x3000** -- Verify produces 1024x768 (per spec worked example). | Status: done
- [x] **Test OpenAI high detail resize -- 1920x1080** -- Verify produces 1365x768 (per spec token table). | Status: done
- [x] **Test OpenAI high detail resize -- 800x600** -- Verify passes through unchanged (both dimensions within bounds). | Status: done
- [x] **Test OpenAI high detail resize -- 256x256** -- Verify passes through unchanged (no upscale). | Status: done
- [x] **Test Anthropic resize -- 4000x3000** -- Verify triggers both longest-side and pixel-count constraints. Final dimensions ~1446x1084 (per spec). | Status: done
- [ ] **Test Anthropic resize -- 1920x1080** -- Verify triggers longest-side constraint only. Result ~1568x882. | Status: not_done
- [x] **Test Anthropic resize -- 1024x768** -- Verify passes through unchanged. | Status: done
- [ ] **Test Gemini resize -- 4000x3000** -- Verify resizes to 3600x2700. | Status: not_done
- [ ] **Test Gemini resize -- 3000x2000** -- Verify passes through unchanged. | Status: not_done
- [ ] **Test aspect ratio preservation** -- Verify aspect ratio is preserved within 1px rounding for all providers and all test dimensions. | Status: not_done
- [ ] **Test no-upscale invariant** -- Verify images smaller than target dimensions are never upscaled for all providers. | Status: not_done
- [x] **Test custom maxWidth/maxHeight** -- Verify custom dimensions override provider defaults but provider ceiling still applies (e.g., maxWidth: 4000 on Anthropic still caps at 1568). | Status: done

### Token Estimation Tests (`src/__tests__/tokens.test.ts`)

- [x] **Test OpenAI low detail -- flat 85** -- Verify any dimensions return 85 tokens. | Status: done
- [x] **Test OpenAI high detail -- 512x512** -- Verify 1x1 tile = 255 tokens. | Status: done
- [x] **Test OpenAI high detail -- 1024x768** -- Verify 2x2 tiles = 765 tokens. | Status: done
- [x] **Test OpenAI high detail -- 1920x1080** -- Verify after resize to 1365x768, 3x2 tiles = 1105 tokens. | Status: done
- [x] **Test OpenAI high detail -- 4000x3000** -- Verify after resize to 1024x768, 2x2 tiles = 765 tokens. | Status: done
- [x] **Test OpenAI high detail -- 800x600** -- Verify 2x2 tiles = 765 tokens (no resize needed). | Status: done
- [x] **Test OpenAI high detail -- 256x256** -- Verify 1x1 tile = 255 tokens. | Status: done
- [x] **Test Anthropic -- 256x256** -- Verify 88 tokens. | Status: done
- [x] **Test Anthropic -- 1024x768** -- Verify 1049 tokens. | Status: done
- [x] **Test Anthropic -- 1920x1080** -- Verify 1844 tokens (after resize). | Status: done
- [ ] **Test Anthropic -- 4000x3000** -- Verify 2090 tokens (after resize, pixel-capped). | Status: not_done
- [ ] **Test Anthropic -- 1568x1000** -- Verify 2091 tokens. | Status: not_done
- [x] **Test Gemini -- any dimensions** -- Verify flat 258 tokens for various dimensions. | Status: done
- [ ] **Test dollar cost calculation** -- Verify correct USD cost when model pricing is available (e.g., gpt-4o at $2.50/MTok: 765 tokens = $0.001913). | Status: not_done
- [x] **Test dollar cost undefined without model-price-registry** -- Verify cost is `undefined` when the registry is not installed. | Status: done

### Content Block Format Tests (`src/__tests__/content-block.test.ts`)

- [x] **Test OpenAI content block structure** -- Verify `{ type: 'image_url', image_url: { url: 'data:{mimeType};base64,...', detail } }` format. Verify data URL prefix is included. | Status: done
- [x] **Test Anthropic content block structure** -- Verify `{ type: 'image', source: { type: 'base64', media_type: '{mimeType}', data: '{rawBase64}' } }` format. Verify no data URL prefix in `data` field. Verify `media_type` is full MIME type. | Status: done
- [x] **Test Gemini content block structure** -- Verify `{ inlineData: { mimeType: '{mimeType}', data: '{rawBase64}' } }` format. Verify no data URL prefix. | Status: done
- [x] **Test MIME type accuracy** -- Verify the MIME type in the content block matches the actual encoded format (e.g., JPEG input produces `image/jpeg`). | Status: done

### Optimization Tests (`src/__tests__/optimize.test.ts`)

- [ ] **Test JPEG quality reduces file size** -- Verify lower quality settings produce smaller output files. | Status: not_done
- [ ] **Test EXIF metadata stripping** -- Verify EXIF data is removed when `stripMetadata: true`. | Status: not_done
- [ ] **Test PNG compression level** -- Verify PNG compression level affects file size but not dimensions. | Status: not_done
- [ ] **Test BMP to JPEG conversion** -- Verify BMP input is converted to JPEG for OpenAI and Anthropic providers. | Status: not_done
- [ ] **Test JPEG to WebP conversion** -- Verify conversion works when `preferWebp: true`. | Status: not_done
- [ ] **Test file size limit enforcement** -- Verify that images exceeding provider file size limit trigger quality reduction. | Status: not_done
- [ ] **Test minimum quality produces valid output** -- Verify quality 20 still produces a valid image for reasonable inputs. | Status: not_done
- [ ] **Test ImageTooLargeError** -- Verify error is thrown when image cannot be compressed below the provider's size limit at minimum quality. | Status: not_done

### Batch Processing Tests (`src/__tests__/batch.test.ts`)

- [x] **Test all images processed** -- Verify all images in a batch are processed and returned. | Status: done
- [x] **Test result order preservation** -- Verify results are returned in the same order as inputs. | Status: done
- [x] **Test totalTokens aggregation** -- Verify `totalTokens` is the sum of individual `tokens` values. | Status: done
- [x] **Test concurrency limiting** -- Verify `concurrency` option limits the number of parallel operations. | Status: done
- [x] **Test continueOnError: true** -- Verify remaining images are processed when one fails. Failed images reported as `BatchError`. | Status: done
- [x] **Test continueOnError: false** -- Verify processing stops on first failure. | Status: done
- [x] **Test failed image error reporting** -- Verify `BatchError` includes correct `index`, `code`, and `message`. | Status: done

### Factory Tests (`src/__tests__/factory.test.ts`)

- [x] **Test createPreparer returns ImagePreparer** -- Verify the returned object has `prepare`, `prepareBatch`, and `estimateTokens` methods. | Status: done
- [x] **Test pre-configured options are applied** -- Verify the factory's config (provider, quality, detail, etc.) is used when no per-call options are provided. | Status: done
- [x] **Test per-call options override pre-configured** -- Verify per-call options take precedence over factory config. | Status: done

### Error Handling Tests

- [ ] **Test ImageNotFoundError** -- Verify thrown for non-existent file paths with correct error code and message. | Status: not_done
- [ ] **Test ImageFetchError** -- Verify thrown for invalid URLs, non-2xx responses, and non-image content types. | Status: not_done
- [ ] **Test InvalidImageError** -- Verify thrown for corrupted image data. | Status: not_done
- [ ] **Test InvalidBase64Error** -- Verify thrown for invalid base64 strings. | Status: not_done
- [ ] **Test UnsupportedProviderError** -- Verify thrown for unknown provider strings. | Status: not_done

---

## Phase 10: Integration Tests

- [ ] **Test prepare JPEG for each provider** -- Prepare a real JPEG fixture file for OpenAI, Anthropic, and Gemini. Verify output dimensions, token count, and content block format. | Status: not_done
- [ ] **Test prepare PNG** -- Prepare a PNG fixture and verify PNG-specific behavior (lossless compression). | Status: not_done
- [ ] **Test prepare WebP** -- Prepare a WebP fixture and verify it is accepted by all providers. | Status: not_done
- [ ] **Test prepare large image (4000x3000)** -- Verify correct resize per each provider. | Status: not_done
- [ ] **Test prepare small image (64x64)** -- Verify the image is not upscaled for any provider. | Status: not_done
- [ ] **Test prepare from URL** -- Set up a local HTTP server in tests, serve an image, and verify preparation from the URL. | Status: not_done
- [ ] **Test prepare from Buffer** -- Verify identical output to file path preparation. | Status: not_done
- [ ] **Test prepare from base64 string** -- Verify identical output to file path preparation. | Status: not_done
- [ ] **Test batch processing 5 images** -- Batch-process 5 images and verify aggregate statistics (totalTokens, totalCost, totalOriginalBytes, totalOptimizedBytes). | Status: not_done

---

## Phase 11: Edge Case Tests

- [x] **Test 1x1 pixel image** -- Verify correct handling for all providers. | Status: done
- [ ] **Test extreme aspect ratio (10000x10)** -- Verify resize and token calculation handle extreme wide images. | Status: not_done
- [ ] **Test extreme aspect ratio (10x10000)** -- Verify resize and token calculation handle extreme tall images. | Status: not_done
- [ ] **Test exact provider dimension limits** -- Test 2048x2048 for OpenAI, 1568x1568 for Anthropic, 3600x3600 for Gemini. Verify no unnecessary resize. | Status: not_done
- [ ] **Test image at exactly Anthropic file size limit (5 MB)** -- Verify it passes without quality reduction. | Status: not_done
- [ ] **Test animated GIF handling** -- Verify first frame is used or image passes through depending on provider behavior. | Status: not_done
- [ ] **Test EXIF orientation tag** -- Verify rotated images are handled correctly after metadata strip (auto-orient). | Status: not_done
- [ ] **Test empty Buffer input** -- Verify appropriate error is thrown. | Status: not_done
- [ ] **Test URL returning 404** -- Verify `ImageFetchError` is thrown. | Status: not_done
- [ ] **Test URL returning HTML** -- Verify `ImageFetchError` is thrown (non-image content type). | Status: not_done
- [ ] **Test URL timeout** -- Verify `ImageFetchError` is thrown when URL fetch exceeds timeout. | Status: not_done
- [ ] **Test concurrent prepare() calls** -- Verify no file locking issues when the same image is prepared concurrently. | Status: not_done

---

## Phase 12: CLI Tests (`src/__tests__/cli.test.ts`)

- [ ] **Test CLI prepare command** -- Execute `vision-prep prepare openai <fixture>` as a subprocess and verify output. | Status: not_done
- [ ] **Test CLI prepare --json** -- Verify JSON output contains all `PreparedImage` fields. | Status: not_done
- [ ] **Test CLI prepare --base64** -- Verify raw base64 string is output to stdout. | Status: not_done
- [ ] **Test CLI prepare --output** -- Verify the optimized image is written to the specified file. | Status: not_done
- [ ] **Test CLI batch command** -- Execute `vision-prep batch anthropic <fixtures...>` and verify output. | Status: not_done
- [ ] **Test CLI batch --json** -- Verify JSON output contains all `BatchResult` fields. | Status: not_done
- [ ] **Test CLI batch --output-dir** -- Verify optimized images are written to the directory. | Status: not_done
- [ ] **Test CLI estimate command** -- Execute `vision-prep estimate openai --dimensions 1920x1080` and verify output. | Status: not_done
- [ ] **Test CLI estimate --json** -- Verify JSON output contains token estimate. | Status: not_done
- [ ] **Test CLI --version** -- Verify version number is printed. | Status: not_done
- [ ] **Test CLI --help** -- Verify help text is printed. | Status: not_done
- [ ] **Test CLI exit code 0** -- Verify exit code 0 on success. | Status: not_done
- [ ] **Test CLI exit code 1** -- Verify exit code 1 on processing error (e.g., corrupted image). | Status: not_done
- [ ] **Test CLI exit code 2** -- Verify exit code 2 on configuration error (e.g., invalid provider). | Status: not_done
- [ ] **Test CLI --quiet mode** -- Verify no output except errors when quiet is enabled. | Status: not_done

---

## Phase 13: Documentation

- [ ] **Create README.md** -- Write the package README with: overview, installation instructions (including sharp peer dependency), quick start examples, API reference for all exported functions, CLI usage with all commands/flags, provider comparison table, configuration defaults, and integration examples with monorepo packages. | Status: not_done
- [ ] **Add JSDoc comments to all public functions** -- Document `prepare`, `prepareForOpenAI`, `prepareForAnthropic`, `prepareForGemini`, `estimateTokens`, `prepareBatch`, `createPreparer` with parameter descriptions, return types, examples, and thrown errors. | Status: not_done
- [x] **Add JSDoc comments to all type interfaces** -- Document all fields in `PrepareOptions`, `PreparedImage`, `TokenEstimate`, `BatchResult`, etc. with descriptions and defaults. | Status: done
- [ ] **Document error classes** -- Add JSDoc to each error class describing when it is thrown and what information it contains. | Status: not_done

---

## Phase 14: Build and Publish Preparation

- [ ] **Verify TypeScript compilation** -- Run `npm run build` and ensure all source files compile without errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.js.map` files. | Status: not_done
- [ ] **Verify lint passes** -- Run `npm run lint` and fix any issues. | Status: not_done
- [ ] **Verify all tests pass** -- Run `npm run test` (vitest) and ensure all unit, integration, and edge case tests pass. | Status: not_done
- [ ] **Verify package.json completeness** -- Ensure `name`, `version`, `description`, `main`, `types`, `files`, `bin`, `scripts`, `engines`, `peerDependencies`, `peerDependenciesMeta`, `keywords`, `license` are all correctly set. | Status: not_done
- [ ] **Add appropriate keywords** -- Add keywords to `package.json`: `vision`, `llm`, `image`, `openai`, `anthropic`, `gemini`, `base64`, `resize`, `token`, `cost`. | Status: not_done
- [ ] **Bump version to 0.1.0** -- Ensure `package.json` version is set to `0.1.0` for initial release. | Status: not_done
- [ ] **Verify dist files are correct** -- Ensure `"files": ["dist"]` includes all needed outputs and the CLI entry point has the shebang line. | Status: not_done
