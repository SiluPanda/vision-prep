# vision-prep -- Specification

## 1. Overview

`vision-prep` is an image preparation library for vision LLM APIs. Given an image (file path, URL, Buffer, or base64 string) and a target provider, it resizes the image to the provider's optimal dimensions, compresses it, encodes it to base64, estimates the vision token cost, and returns a prepared image object ready to embed in an API request. It answers the question "how should I send this image to this model?" with a single function call: `prepare(image, 'openai')`, returning a `PreparedImage` object with the base64 data, MIME type, dimensions, token count, estimated cost, and a provider-formatted content block ready to paste into a messages array.

The gap this package fills is specific and well-documented. Each major vision LLM provider has different image sizing rules, format requirements, file size limits, and token cost formulas. OpenAI divides images into 512x512 tiles and charges per tile. Anthropic scales images to fit within 1568px on the longest side and charges based on pixel count. Google Gemini charges a flat token count per image regardless of size. A developer sending images to any of these providers must manually resize images to avoid paying for unnecessary resolution, compress them to stay within file size limits, encode them to base64, format the content block in the provider's specific structure, and calculate token costs for budgeting. No existing package combines these concerns. Developers cobble together `sharp` for resizing, `Buffer.toString('base64')` for encoding, and ad-hoc formulas for token estimation -- repeating this work in every vision-capable application.

The cost impact is material. A 4000x3000 photo sent to OpenAI at `detail: "high"` is first scaled to fit 2048x2048 (becoming 2048x1536), then the shortest side is scaled to 768px (becoming 1024x768), then tiled into 512x512 patches (2x2 = 4 tiles), costing 4 x 170 + 85 = 765 tokens. If the developer resizes the image to 1024x768 before sending, the same calculation applies but the image bytes transferred are smaller and the developer knows the exact cost in advance. More importantly, if the developer downgrades to `detail: "low"`, the cost drops to a flat 85 tokens -- an 9x reduction. At scale (thousands of images per day), choosing the right resize strategy per provider saves significant money and reduces latency from base64-encoding unnecessarily large payloads.

`vision-prep` provides both a TypeScript/JavaScript API for programmatic use and a CLI for quick terminal-based image preparation. The API returns structured `PreparedImage` objects with all metadata needed for API integration. The CLI reads images from files, resizes them for a target provider, and outputs base64 data or writes optimized images to disk. A factory function `createPreparer` enables pre-configuring a provider and quality settings for repeated use.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `prepare(image, provider, options?)` function that reads an image from any supported source (file path, URL, Buffer, base64 string), resizes it to the target provider's optimal dimensions, compresses it, encodes it to base64, estimates the vision token cost, and returns a `PreparedImage` object with all metadata.
- Provide per-provider convenience functions -- `prepareForOpenAI(image, options?)`, `prepareForAnthropic(image, options?)`, `prepareForGemini(image, options?)` -- that are equivalent to calling `prepare` with the provider argument pre-filled.
- Provide an `estimateTokens(image, provider, options?)` function that calculates the vision token cost for an image without performing the full resize/encode pipeline. Accepts either image dimensions (width, height) or an image source from which dimensions are extracted.
- Provide a `prepareBatch(images, provider, options?)` function that processes multiple images in parallel, returning an array of `PreparedImage` results with aggregate token count and cost.
- Apply provider-specific resize logic automatically: OpenAI `detail: "low"` resizes to fit 512x512; OpenAI `detail: "high"` constrains to 2048x2048 then scales the shortest side to 768px; Anthropic constrains the longest side to 1568px and total pixel count to 1,568,000; Gemini constrains to 3600x3600.
- Never upscale images. If an image is already smaller than the provider's target dimensions, it is used as-is.
- Preserve aspect ratio during all resize operations.
- Compress images to stay within provider file size limits: 20 MB for OpenAI, 5 MB for Anthropic, 20 MB for Gemini.
- Return provider-formatted content blocks alongside raw base64 data: OpenAI's `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }`, Anthropic's `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "..." } }`, Gemini's `{ inlineData: { mimeType: "image/jpeg", data: "..." } }`.
- Estimate token cost using each provider's formula and optionally convert to USD using per-model pricing from `model-price-registry`.
- Provide a `createPreparer(config)` factory function that returns a pre-configured preparer instance, avoiding repeated provider and option specification.
- Provide a CLI (`vision-prep`) for preparing images from the command line, with support for batch processing, JSON output, and writing optimized images to disk.
- Support JPEG, PNG, GIF, and WebP input formats across all providers. Convert formats when necessary for provider compatibility.
- Target Node.js 18+. Use `sharp` as the default image processing backend with an optional `jimp` fallback for environments where native dependencies are problematic.

### Non-Goals

- **Not an image editor.** This package resizes, compresses, and encodes images for LLM consumption. It does not crop, rotate, apply filters, add watermarks, or perform any visual modifications beyond dimension scaling and quality compression.
- **Not an LLM client.** This package produces the image content blocks that the caller passes to provider SDKs (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`). It does not make API calls to any provider.
- **Not an image analysis tool.** This package prepares images for analysis by LLMs. It does not perform OCR, object detection, classification, or any computer vision tasks itself.
- **Not a general-purpose image processing library.** For advanced image manipulation (compositing, drawing, color space conversion), use `sharp` or `jimp` directly. This package uses those libraries internally but exposes only LLM-preparation functionality.
- **Not a token counter for non-image content.** This package estimates vision token costs for images only. For text token counting, use `prompt-price` from this monorepo. For combined text+image cost estimation, compose `vision-prep`'s token estimates with `prompt-price`'s text estimates.
- **Not a file format converter.** While this package may convert between image formats when a provider requires it (e.g., converting BMP to JPEG), general-purpose format conversion is not a goal. The conversion is a side effect of provider compatibility, not a feature.

---

## 3. Target Users and Use Cases

### Vision AI Application Developers

Developers building applications that send images to vision LLMs -- document analysis tools, product image analyzers, screenshot-based debugging assistants, visual Q&A systems. These developers need to prepare images correctly for their target provider without studying each provider's sizing rules. A typical integration replaces 15-20 lines of manual sharp + base64 + token calculation code with a single `prepare()` call.

### Multi-Provider Vision Pipelines

Teams building applications that support multiple vision LLM providers (OpenAI, Anthropic, Gemini) and need to prepare the same image differently for each. The same 4000x3000 photo requires different resize dimensions, different content block formats, and different token cost calculations for each provider. `vision-prep` handles all three with a single image source and a provider parameter.

### Cost-Conscious AI Teams

Engineering teams processing large volumes of images through vision LLMs (thousands per day) who need to optimize image dimensions to minimize token costs without degrading analysis quality. `prepare()` automatically downsizes images to each provider's optimal dimensions, avoiding the common mistake of sending full-resolution camera photos (12+ megapixels) to APIs that internally downscale them anyway.

### Document Processing Pipelines

Teams building automated document processing systems that photograph or scan documents, prepare them for LLM analysis (data extraction, summarization, classification), and need consistent image preparation across a batch. `prepareBatch()` processes multiple page images in parallel with aggregate cost reporting.

### CLI and Script Users

Developers writing shell scripts or automation that prepare images before sending to LLM APIs. The CLI provides a scriptable interface: resize an image for a target provider, output the base64 string, and print the token cost -- all in one command.

---

## 4. Core Concepts

### Image Source

An image source is the input to the preparation pipeline. `vision-prep` accepts four source types:

- **File path**: An absolute or relative path to an image file on disk. The file is read with `node:fs` and its format is detected from the file header (magic bytes), not the file extension.
- **URL**: An HTTP or HTTPS URL pointing to an image. The image is fetched with `node:fetch` (Node.js 18+ built-in). Redirects are followed. The response body is consumed as a Buffer.
- **Buffer**: A Node.js `Buffer` or `Uint8Array` containing raw image bytes. Format is detected from magic bytes.
- **Base64 string**: A base64-encoded image string, optionally prefixed with a data URL header (`data:image/jpeg;base64,...`). The prefix is parsed for MIME type; the base64 data is decoded to a Buffer for processing.

All four source types are normalized to a Buffer internally before processing begins. The `ImageSource` type is a union:

```typescript
type ImageSource = string | Buffer | Uint8Array;
```

When the input is a `string`, the package determines whether it is a file path, a URL, or base64 data by inspecting the string: strings starting with `http://` or `https://` are treated as URLs; strings starting with `data:` are treated as base64 data URLs; strings containing only base64-valid characters with a length greater than 260 (the maximum path length on most systems) are treated as raw base64; all other strings are treated as file paths.

### Provider

A provider identifies the target vision LLM API. Supported providers are `'openai'`, `'anthropic'`, and `'gemini'`. Each provider has different image requirements (dimensions, file size, format support), different resize strategies, different content block formats, and different token cost formulas. The provider determines every step of the preparation pipeline.

### Prepared Image

A `PreparedImage` is the output of the preparation pipeline. It contains everything needed to embed the image in an API request and to understand the cost implications:

- The base64-encoded image data (after resize and compression).
- The MIME type of the encoded image (`image/jpeg`, `image/png`, `image/gif`, `image/webp`).
- The final dimensions (width and height after resizing).
- The estimated vision token count for the target provider.
- The estimated cost in USD (optional, requires model specification).
- The original image dimensions and byte size (for before/after comparison).
- The optimized byte size (after resize and compression).
- A provider-formatted content block ready to embed in a messages array.

### Resize Strategy

A resize strategy defines how an image is scaled down to meet a provider's requirements. Each provider has a different strategy:

- **OpenAI low**: Resize to fit within 512x512, maintaining aspect ratio. No tiling calculation.
- **OpenAI high**: First constrain to fit within 2048x2048, maintaining aspect ratio. Then scale so the shortest side is at most 768px. The resulting dimensions determine tile count.
- **Anthropic**: Resize so the longest side is at most 1568px and the total pixel count is at most 1,568,000, maintaining aspect ratio.
- **Gemini**: Resize to fit within 3600x3600, maintaining aspect ratio.
- **Custom**: Caller specifies maximum width and height. The image is resized to fit within these bounds, maintaining aspect ratio.

All strategies share two invariants: aspect ratio is always preserved, and images are never upscaled. If an image already fits within the target dimensions, it is not resized.

### Token Cost Estimation

Vision token cost varies by provider. `vision-prep` implements each provider's documented formula:

- **OpenAI**: Tile-based. Divide the (possibly resized) image into 512x512 tiles. Each tile costs 170 tokens. Add a base of 85 tokens per image. Low-detail mode is a flat 85 tokens.
- **Anthropic**: Dimension-based. After auto-scaling to fit within 1568px / 1,568,000 pixels, the cost is `ceil(width * height / 750)` tokens.
- **Gemini**: Flat. 258 tokens per image regardless of dimensions.

Token costs translate to dollar costs when a specific model is known. For example, OpenAI GPT-4o charges $2.50 per million input tokens, so 765 image tokens cost $0.001913.

---

## 5. Provider Image Requirements

This section catalogs every known image requirement, sizing rule, token formula, and format restriction for each supported provider.

### OpenAI (GPT-4o, GPT-4.1, GPT-4 Turbo)

OpenAI vision models accept images as base64 data URLs or HTTPS URLs in a `content` array within a user message. Images are processed using a tile-based system that determines token cost.

**Image constraints:**

| Constraint | Value |
|---|---|
| Maximum file size | 20 MB |
| Maximum dimensions | No hard limit, but images are internally scaled to fit 2048x2048 (high) or 512x512 (low) |
| Supported formats | JPEG, PNG, GIF (first frame only), WebP |
| Detail modes | `low`, `high`, `auto` (default: `auto`) |

**Detail mode behavior:**

| Mode | Resize behavior | Token formula |
|---|---|---|
| `low` | Image is resized to fit 512x512 | Flat 85 tokens |
| `high` | Image is constrained to 2048x2048, then shortest side scaled to 768px | `ceil(width/512) * ceil(height/512) * 170 + 85` |
| `auto` | API chooses low or high based on image size (typically high for images > 512x512) | Depends on chosen mode |

**High-detail resize algorithm:**

1. If either dimension exceeds 2048px, scale the image proportionally so the largest dimension is 2048px.
2. After step 1, if the shortest side exceeds 768px, scale the image proportionally so the shortest side is 768px.
3. Count tiles: `tilesX = ceil(width / 512)`, `tilesY = ceil(height / 512)`.
4. Token cost: `tilesX * tilesY * 170 + 85`.

**Worked example -- 4000x3000 photo at high detail:**

1. Largest dimension is 4000 > 2048. Scale by `2048/4000 = 0.512`. New size: `2048 x 1536`.
2. Shortest side is 1536 > 768. Scale by `768/1536 = 0.5`. New size: `1024 x 768`.
3. Tiles: `ceil(1024/512) x ceil(768/512) = 2 x 2 = 4` tiles.
4. Tokens: `4 * 170 + 85 = 765` tokens.

**Worked example -- 800x600 photo at high detail:**

1. Largest dimension is 800 < 2048. No scaling in step 1.
2. Shortest side is 600 < 768. No scaling in step 2.
3. Tiles: `ceil(800/512) x ceil(600/512) = 2 x 2 = 4` tiles.
4. Tokens: `4 * 170 + 85 = 765` tokens.

**Worked example -- 512x512 icon at low detail:**

1. Image fits within 512x512. No resizing.
2. Tokens: flat 85 tokens.

**Content block format:**

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,/9j/4AAQ...",
    "detail": "high"
  }
}
```

### Anthropic (Claude Sonnet 4.5, Claude Opus 4, Claude Haiku 3.5)

Anthropic vision models accept images as base64-encoded data in a structured content block within a user message. Images are automatically downscaled by the API if they exceed dimension limits, but this downscaling still consumes the same tokens as if the client had resized first -- the API charges based on the image's original dimensions up to its internal limits.

**Image constraints:**

| Constraint | Value |
|---|---|
| Maximum file size | 5 MB (per image) |
| Maximum longest side | 1568 px (auto-scaled by API) |
| Maximum total pixels | 1,568,000 (auto-scaled by API) |
| Supported formats | JPEG, PNG, GIF, WebP |
| Maximum images per request | 20 (varies by tier) |

**Resize algorithm:**

1. If the longest side exceeds 1568px, scale the image proportionally so the longest side is 1568px.
2. After step 1, if the total pixel count (width x height) exceeds 1,568,000, scale the image proportionally so the total pixel count is at most 1,568,000.

**Token formula:**

```
tokens = ceil(width * height / 750)
```

Applied to the dimensions after resize steps 1 and 2. Minimum: 1 token. The practical maximum is approximately `ceil(1,568,000 / 750) = 2091` tokens, though typical images land well below this.

**Worked example -- 4000x3000 photo:**

1. Longest side is 4000 > 1568. Scale by `1568/4000 = 0.392`. New size: `1568 x 1176`.
2. Pixel count: `1568 * 1176 = 1,843,968 > 1,568,000`. Scale by `sqrt(1,568,000 / 1,843,968) = 0.9222`. New size: `1446 x 1084`.
3. Tokens: `ceil(1446 * 1084 / 750) = ceil(2,089,464 / 750) = 2,786`. Wait -- let me recalculate. `1446 * 1084 = 1,567,464`. Tokens: `ceil(1,567,464 / 750) = 2090`.

**Worked example -- 1024x768 photo:**

1. Longest side is 1024 < 1568. No scaling in step 1.
2. Pixel count: `1024 * 768 = 786,432 < 1,568,000`. No scaling in step 2.
3. Tokens: `ceil(786,432 / 750) = 1049`.

**Worked example -- 256x256 icon:**

1. No scaling needed.
2. Tokens: `ceil(65,536 / 750) = 88`.

**Content block format:**

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/jpeg",
    "data": "/9j/4AAQ..."
  }
}
```

Note: the `media_type` field uses the full MIME type string, not just the subtype. Anthropic requires this field to be accurate -- sending a PNG with `media_type: "image/jpeg"` may cause errors.

### Google Gemini (Gemini 2.5 Pro, Gemini 2.5 Flash)

Gemini models accept images as inline base64 data or as file URIs (via the Files API). Token cost is flat per image, making image optimization less critical for token cost but still important for API latency and file size limits.

**Image constraints:**

| Constraint | Value |
|---|---|
| Maximum file size | 20 MB (inline), larger via Files API |
| Maximum dimensions | 3600 x 3600 |
| Supported formats | JPEG, PNG, GIF, WebP, BMP |
| Maximum images per request | Varies by model |

**Token formula:**

```
tokens = 258 per image (standard)
```

Gemini charges a flat 258 tokens per image regardless of image dimensions. This makes token cost predictable but means there is no token savings from resizing. However, resizing still reduces file size (faster upload) and ensures images fit within the 3600x3600 dimension limit.

**Resize algorithm:**

1. If either dimension exceeds 3600px, scale the image proportionally so the largest dimension is 3600px.

**Content block format:**

```json
{
  "inlineData": {
    "mimeType": "image/jpeg",
    "data": "/9j/4AAQ..."
  }
}
```

### Provider Comparison

| Feature | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| Max file size | 20 MB | 5 MB | 20 MB |
| Max dimensions | 2048x2048 (high detail) | 1568px longest side | 3600x3600 |
| Token formula | Tile-based (170/tile + 85) | Pixel-based (wxh/750) | Flat 258 |
| Low-cost mode | `detail: "low"` (85 tokens) | N/A | N/A |
| Min tokens/image | 85 (low) | 1 | 258 |
| Max tokens/image | ~1,105 (high, max tiles) | ~2,091 | 258 |
| Supported formats | JPEG, PNG, GIF, WebP | JPEG, PNG, GIF, WebP | JPEG, PNG, GIF, WebP, BMP |
| Content block key | `image_url` | `source` | `inlineData` |
| Base64 format | Data URL in `url` field | Raw base64 in `data` field | Raw base64 in `data` field |

---

## 6. Image Processing Pipeline

When `prepare()` is called, the image passes through a seven-step pipeline. Each step is independent and produces an intermediate result consumed by the next step.

### Step 1: Read Image

The image source is normalized to a Buffer.

- **File path**: Read with `fs.readFile()`. If the file does not exist, throw `ImageNotFoundError`.
- **URL**: Fetch with `fetch()`. Follow redirects. If the response is not 2xx or does not have an image content type, throw `ImageFetchError`. Respect a configurable timeout (default: 30 seconds).
- **Buffer**: Used as-is.
- **Base64 string**: Strip the data URL prefix if present, decode from base64 to Buffer. If decoding fails, throw `InvalidBase64Error`.

### Step 2: Detect Format and Dimensions

Read the image header (magic bytes) to determine the format (JPEG, PNG, GIF, WebP, BMP). Extract width and height from the header without decoding the full image. This uses the image processing backend's metadata function (`sharp(buffer).metadata()` or equivalent).

If the format is not supported by the target provider, mark it for conversion in Step 4. If the image is corrupted or unreadable, throw `InvalidImageError`.

### Step 3: Resize for Target Provider

Apply the provider-specific resize strategy (see Section 5). The resize operation:

- Uses the `fit: 'inside'` strategy (scale down to fit within bounds, never upscale, preserve aspect ratio).
- Does not resize if the image already fits within the provider's constraints.
- Records both original and resized dimensions for the `PreparedImage` metadata.

When the caller specifies custom `maxWidth` and `maxHeight` options, these override the provider defaults. The provider's constraints are still applied as a ceiling -- the image is resized to the smaller of the custom dimensions and the provider's maximum dimensions.

### Step 4: Optimize

Compress the image to reduce file size:

- **JPEG**: Apply configurable quality (default: 85, range 1-100). Strip EXIF metadata to reduce size and avoid orientation issues.
- **PNG**: Apply compression level (default: 6, range 0-9). Use adaptive filtering.
- **WebP**: Apply configurable quality (default: 85). Preferred for smallest file size when the provider supports it.
- **GIF**: Pass through without recompression (GIF compression is lossless and re-encoding rarely helps).

If the image exceeds the provider's file size limit after compression, reduce quality iteratively (decrease by 10 per step, down to quality 20) until the file fits. If it still exceeds the limit at minimum quality, throw `ImageTooLargeError`.

Format conversion happens in this step when needed:

- BMP inputs are converted to JPEG (BMP is only supported by Gemini; for Anthropic and OpenAI, conversion is required).
- If `options.format` is specified, the image is converted to that format.
- If `options.preferWebp` is true and the provider supports WebP, JPEG and PNG inputs are converted to WebP for smaller file size.

### Step 5: Encode to Base64

Convert the optimized image Buffer to a base64 string using `buffer.toString('base64')`. This step is pure encoding -- no data transformation.

### Step 6: Estimate Token Cost

Calculate the vision token cost using the provider's formula (see Section 5). The calculation uses the final resized dimensions (after Step 3), not the original dimensions.

If a model identifier is provided in options, look up the model's input pricing from `model-price-registry` and calculate the dollar cost:

```
cost = tokens / 1_000_000 * inputPricePerMTok
```

### Step 7: Return PreparedImage

Assemble and return the `PreparedImage` object containing all results from the pipeline.

---

## 7. Resize Strategies

This section provides the exact resize algorithm for each provider, expressed as pseudocode that the implementation must follow.

### OpenAI Low Detail

```
function resizeForOpenAILow(width, height):
  maxDim = 512
  if width <= maxDim AND height <= maxDim:
    return (width, height)  // no resize needed
  scale = min(maxDim / width, maxDim / height)
  return (round(width * scale), round(height * scale))
```

Token cost is always 85, regardless of actual dimensions.

### OpenAI High Detail

```
function resizeForOpenAIHigh(width, height):
  // Step 1: fit within 2048x2048
  if width > 2048 OR height > 2048:
    scale = min(2048 / width, 2048 / height)
    width = round(width * scale)
    height = round(height * scale)

  // Step 2: scale shortest side to 768 (only shrink, never enlarge)
  shortSide = min(width, height)
  if shortSide > 768:
    scale = 768 / shortSide
    width = round(width * scale)
    height = round(height * scale)

  return (width, height)

function openAIHighTokens(width, height):
  (w, h) = resizeForOpenAIHigh(width, height)
  tilesX = ceil(w / 512)
  tilesY = ceil(h / 512)
  return tilesX * tilesY * 170 + 85
```

### Anthropic

```
function resizeForAnthropic(width, height):
  // Step 1: longest side <= 1568
  longSide = max(width, height)
  if longSide > 1568:
    scale = 1568 / longSide
    width = round(width * scale)
    height = round(height * scale)

  // Step 2: total pixels <= 1,568,000
  totalPixels = width * height
  if totalPixels > 1_568_000:
    scale = sqrt(1_568_000 / totalPixels)
    width = round(width * scale)
    height = round(height * scale)

  return (width, height)

function anthropicTokens(width, height):
  (w, h) = resizeForAnthropic(width, height)
  return ceil(w * h / 750)
```

### Gemini

```
function resizeForGemini(width, height):
  maxDim = 3600
  if width <= maxDim AND height <= maxDim:
    return (width, height)
  scale = min(maxDim / width, maxDim / height)
  return (round(width * scale), round(height * scale))

function geminiTokens(width, height):
  return 258  // flat cost regardless of dimensions
```

### Custom Dimensions

When the caller specifies `maxWidth` and `maxHeight`:

```
function resizeCustom(width, height, maxWidth, maxHeight):
  if width <= maxWidth AND height <= maxHeight:
    return (width, height)
  scale = min(maxWidth / width, maxHeight / height)
  return (round(width * scale), round(height * scale))
```

Custom dimensions are applied first, then the provider's constraints are applied as a ceiling. For example, if the caller specifies `maxWidth: 4000` for Anthropic, the Anthropic constraint of 1568px longest side still applies, resulting in an effective maximum of 1568px.

### Upscale Prevention

All resize functions share the invariant: `scale` is always clamped to `min(scale, 1)`. If an image is 200x150 and the provider's target is 512x512, the image remains 200x150. Upscaling introduces artifacts and increases file size without providing more visual information to the model.

---

## 8. Token Cost Estimation

### OpenAI Token Calculation

```typescript
function estimateOpenAITokens(
  width: number,
  height: number,
  detail: 'low' | 'high' | 'auto',
): number {
  if (detail === 'low') return 85;

  // Step 1: fit within 2048x2048
  let w = width;
  let h = height;
  if (w > 2048 || h > 2048) {
    const scale = Math.min(2048 / w, 2048 / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Step 2: scale shortest side to 768
  const shortSide = Math.min(w, h);
  if (shortSide > 768) {
    const scale = 768 / shortSide;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const tilesX = Math.ceil(w / 512);
  const tilesY = Math.ceil(h / 512);
  return tilesX * tilesY * 170 + 85;
}
```

**Token cost examples:**

| Input dimensions | Detail | After resize | Tiles | Tokens |
|---|---|---|---|---|
| 512x512 | low | 512x512 | N/A | 85 |
| 512x512 | high | 512x512 | 1x1 | 255 |
| 1024x768 | high | 1024x768 | 2x2 | 765 |
| 1920x1080 | high | 1365x768 | 3x2 | 1,105 |
| 4000x3000 | high | 1024x768 | 2x2 | 765 |
| 800x600 | high | 800x600 | 2x2 | 765 |
| 256x256 | high | 256x256 | 1x1 | 255 |

### Anthropic Token Calculation

```typescript
function estimateAnthropicTokens(width: number, height: number): number {
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

  return Math.ceil((w * h) / 750);
}
```

**Token cost examples:**

| Input dimensions | After resize | Tokens |
|---|---|---|
| 256x256 | 256x256 | 88 |
| 1024x768 | 1024x768 | 1,049 |
| 1920x1080 | 1568x882 | 1,844 |
| 4000x3000 | 1446x1084 (pixel-capped) | 2,090 |
| 1568x1000 | 1568x1000 | 2,091 |

### Gemini Token Calculation

```typescript
function estimateGeminiTokens(_width: number, _height: number): number {
  return 258;
}
```

Gemini charges a flat 258 tokens per image. Dimensions do not affect token cost.

### Dollar Cost Estimation

When the caller provides a model identifier, `vision-prep` looks up the input token price from `model-price-registry` and calculates the dollar cost:

```
cost = tokens / 1_000_000 * inputPricePerMTok
```

**Cost examples (at published list prices):**

| Provider | Model | Tokens | Input price ($/MTok) | Cost per image |
|---|---|---|---|---|
| OpenAI | gpt-4o | 85 (low) | $2.50 | $0.000213 |
| OpenAI | gpt-4o | 765 (high, 4 tiles) | $2.50 | $0.001913 |
| OpenAI | gpt-4o | 1,105 (high, 6 tiles) | $2.50 | $0.002763 |
| Anthropic | claude-sonnet-4-5 | 1,049 (1024x768) | $3.00 | $0.003147 |
| Anthropic | claude-sonnet-4-5 | 2,090 (max) | $3.00 | $0.006270 |
| Gemini | gemini-2.5-flash | 258 | $0.15 | $0.000039 |
| Gemini | gemini-2.5-pro | 258 | $1.25 | $0.000323 |

### Before-and-After Comparison

The `PreparedImage` object includes both original and optimized metadata, enabling the caller to see the savings:

```typescript
const result = await prepare('./photo-4000x3000.jpg', 'openai', { detail: 'high' });

console.log(result.original);
// { width: 4000, height: 3000, bytes: 3_145_728 }

console.log(result.width, result.height);
// 1024, 768

console.log(result.bytes);
// 98_304  (after JPEG compression at quality 85)

console.log(result.tokens);
// 765

console.log(result.cost);
// 0.001913  (for gpt-4o)
```

---

## 9. API Surface

### Installation

```bash
npm install vision-prep sharp
```

### Peer Dependencies

```json
{
  "peerDependencies": {
    "sharp": ">=0.33.0"
  },
  "peerDependenciesMeta": {
    "sharp": { "optional": true }
  },
  "optionalDependencies": {
    "model-price-registry": "^1.0.0"
  }
}
```

`sharp` is the recommended image processing backend. It is a peer dependency to allow the caller to control the version. When `sharp` is not available (install fails due to native dependency issues), the package falls back to a built-in pure-JavaScript image metadata reader that can extract dimensions and detect formats but cannot resize or compress. In this fallback mode, `prepare()` skips resizing and compression, encodes the raw image to base64, and logs a warning. The `jimp` backend can be configured as an alternative via the `backend` option.

`model-price-registry` is optional. When installed, it enables dollar cost estimation. When absent, the `cost` field in `PreparedImage` is `undefined` and a model pricing warning is logged.

### `prepare`

The primary function. Reads, resizes, compresses, encodes, and estimates token cost for a single image.

```typescript
import { prepare } from 'vision-prep';

const result = await prepare('./photo.jpg', 'openai', {
  detail: 'high',
  quality: 85,
});

console.log(result.width, result.height);  // 1024, 768
console.log(result.tokens);                // 765
console.log(result.mimeType);              // 'image/jpeg'
console.log(result.contentBlock);          // { type: 'image_url', image_url: { ... } }
```

**Signature:**

```typescript
function prepare(
  image: ImageSource,
  provider: Provider,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

### `prepareForOpenAI`

Convenience function equivalent to `prepare(image, 'openai', options)`.

```typescript
import { prepareForOpenAI } from 'vision-prep';

const result = await prepareForOpenAI('./photo.jpg', { detail: 'high' });
```

**Signature:**

```typescript
function prepareForOpenAI(
  image: ImageSource,
  options?: OpenAIPrepareOptions,
): Promise<PreparedImage>;
```

### `prepareForAnthropic`

Convenience function equivalent to `prepare(image, 'anthropic', options)`.

```typescript
import { prepareForAnthropic } from 'vision-prep';

const result = await prepareForAnthropic('./photo.jpg');
```

**Signature:**

```typescript
function prepareForAnthropic(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

### `prepareForGemini`

Convenience function equivalent to `prepare(image, 'gemini', options)`.

```typescript
import { prepareForGemini } from 'vision-prep';

const result = await prepareForGemini('./photo.jpg');
```

**Signature:**

```typescript
function prepareForGemini(
  image: ImageSource,
  options?: PrepareOptions,
): Promise<PreparedImage>;
```

### `estimateTokens`

Calculates vision token cost without performing the full resize/encode pipeline. Accepts image dimensions directly or an image source from which dimensions are extracted.

```typescript
import { estimateTokens } from 'vision-prep';

// From dimensions
const estimate = await estimateTokens({ width: 1920, height: 1080 }, 'openai', {
  detail: 'high',
});
console.log(estimate.tokens);  // 1105
console.log(estimate.cost);   // 0.002763 (for gpt-4o)

// From image file
const estimate2 = await estimateTokens('./photo.jpg', 'anthropic');
console.log(estimate2.tokens);  // 2090
```

**Signature:**

```typescript
function estimateTokens(
  image: ImageSource | { width: number; height: number },
  provider: Provider,
  options?: EstimateOptions,
): Promise<TokenEstimate>;
```

### `prepareBatch`

Processes multiple images in parallel.

```typescript
import { prepareBatch } from 'vision-prep';

const results = await prepareBatch(
  ['./page1.jpg', './page2.jpg', './page3.jpg'],
  'anthropic',
  { quality: 80, concurrency: 4 },
);

console.log(results.images.length);      // 3
console.log(results.totalTokens);        // 4521
console.log(results.totalCost);          // 0.013563
console.log(results.totalOriginalBytes); // 9_437_184
console.log(results.totalOptimizedBytes);// 294_912
```

**Signature:**

```typescript
function prepareBatch(
  images: ImageSource[],
  provider: Provider,
  options?: BatchPrepareOptions,
): Promise<BatchResult>;
```

### `createPreparer`

Factory function that returns a pre-configured preparer instance. Useful when preparing many images for the same provider with the same options.

```typescript
import { createPreparer } from 'vision-prep';

const preparer = createPreparer({
  provider: 'openai',
  detail: 'high',
  quality: 80,
  model: 'gpt-4o',
});

const result1 = await preparer.prepare('./image1.jpg');
const result2 = await preparer.prepare('./image2.jpg');
const batch = await preparer.prepareBatch(['./a.jpg', './b.jpg', './c.jpg']);
```

**Signature:**

```typescript
function createPreparer(config: PreparerConfig): ImagePreparer;

interface ImagePreparer {
  prepare(image: ImageSource, options?: PrepareOptions): Promise<PreparedImage>;
  prepareBatch(images: ImageSource[], options?: BatchPrepareOptions): Promise<BatchResult>;
  estimateTokens(image: ImageSource | { width: number; height: number }, options?: EstimateOptions): Promise<TokenEstimate>;
}
```

### Type Definitions

```typescript
// ── Source and Provider ──────────────────────────────────────────────

/** Image input: file path, URL, Buffer, Uint8Array, or base64 string. */
type ImageSource = string | Buffer | Uint8Array;

/** Supported vision LLM providers. */
type Provider = 'openai' | 'anthropic' | 'gemini';

/** Supported image MIME types. */
type ImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp';

// ── Options ─────────────────────────────────────────────────────────

interface PrepareOptions {
  /** OpenAI detail mode. Only applies to OpenAI provider. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';

  /** JPEG/WebP compression quality (1-100). Default: 85. */
  quality?: number;

  /** Output image format. If not specified, uses the input format
   *  (or JPEG for formats not supported by the provider). */
  format?: 'jpeg' | 'png' | 'webp';

  /** Prefer WebP output for smaller file size. Default: false. */
  preferWebp?: boolean;

  /** Override maximum width. Provider constraints still apply as ceiling. */
  maxWidth?: number;

  /** Override maximum height. Provider constraints still apply as ceiling. */
  maxHeight?: number;

  /** Model identifier for dollar cost estimation (e.g., 'gpt-4o').
   *  Requires model-price-registry. */
  model?: string;

  /** Strip EXIF metadata. Default: true. */
  stripMetadata?: boolean;

  /** Image processing backend. Default: 'sharp'. */
  backend?: 'sharp' | 'jimp';

  /** Timeout for URL fetching in milliseconds. Default: 30_000. */
  fetchTimeout?: number;

  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

interface OpenAIPrepareOptions extends PrepareOptions {
  /** OpenAI detail mode. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';
}

interface EstimateOptions {
  /** OpenAI detail mode. Default: 'high'. */
  detail?: 'low' | 'high' | 'auto';

  /** Model identifier for dollar cost estimation. */
  model?: string;
}

interface BatchPrepareOptions extends PrepareOptions {
  /** Maximum number of images to process concurrently. Default: 4. */
  concurrency?: number;

  /** If true, continue processing remaining images when one fails.
   *  Failed images are returned with error details. Default: false. */
  continueOnError?: boolean;
}

interface PreparerConfig extends PrepareOptions {
  /** Target provider. Required. */
  provider: Provider;
}

// ── Results ─────────────────────────────────────────────────────────

interface PreparedImage {
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

  /** Estimated cost in USD. Undefined if model-price-registry is not
   *  available or no model was specified. */
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

interface TokenEstimate {
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

interface BatchResult {
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

interface BatchError {
  /** The index of the failed image in the input array. */
  index: number;

  /** Error details. */
  error: {
    code: string;
    message: string;
  };
}

// ── Provider Content Blocks ─────────────────────────────────────────

interface OpenAIContentBlock {
  type: 'image_url';
  image_url: {
    url: string;  // "data:image/jpeg;base64,..."
    detail?: 'low' | 'high' | 'auto';
  };
}

interface AnthropicContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;  // "image/jpeg", "image/png", etc.
    data: string;        // raw base64, no prefix
  };
}

interface GeminiContentBlock {
  inlineData: {
    mimeType: string;  // "image/jpeg", "image/png", etc.
    data: string;      // raw base64, no prefix
  };
}
```

### Type Exports

```typescript
export type {
  ImageSource,
  Provider,
  ImageMimeType,
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
};
```

---

## 10. Output Formats

### OpenAI Content Block

The OpenAI vision API expects image content as a data URL embedded in an `image_url` object:

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,/9j/4AAQ...",
    "detail": "high"
  }
}
```

`vision-prep` constructs this block with the full data URL prefix (`data:{mimeType};base64,{data}`) and includes the `detail` mode. The caller embeds this block directly into a messages array:

```typescript
const prepared = await prepareForOpenAI('./photo.jpg', { detail: 'high' });

const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      prepared.contentBlock,
    ],
  },
];
```

### Anthropic Content Block

The Anthropic vision API expects image content as raw base64 data (no data URL prefix) in a structured `source` object:

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/jpeg",
    "data": "/9j/4AAQ..."
  }
}
```

The `media_type` field must be the exact MIME type. The `data` field is raw base64 without any prefix.

```typescript
const prepared = await prepareForAnthropic('./photo.jpg');

const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Describe this document.' },
      prepared.contentBlock,
    ],
  },
];
```

### Gemini Content Block

The Gemini API expects image content as inline data with a `mimeType` and base64 `data`:

```json
{
  "inlineData": {
    "mimeType": "image/jpeg",
    "data": "/9j/4AAQ..."
  }
}
```

```typescript
const prepared = await prepareForGemini('./photo.jpg');

const parts = [
  { text: 'Analyze this image.' },
  prepared.contentBlock,
];
```

### Raw Access

All content block formats are derived from the same underlying data. The caller can also access raw fields directly:

```typescript
const prepared = await prepare('./photo.jpg', 'openai');

// Construct a custom content block
const customBlock = {
  type: 'image_url',
  image_url: {
    url: `data:${prepared.mimeType};base64,${prepared.base64}`,
    detail: 'low',
  },
};
```

---

## 11. Optimization

### JPEG Quality

JPEG quality controls the compression level. Higher quality produces larger files with fewer artifacts. Lower quality produces smaller files with more visible compression.

| Quality | Typical file size (1024x768) | Visual quality |
|---|---|---|
| 100 | 800-1200 KB | Lossless equivalent |
| 85 (default) | 150-300 KB | Indistinguishable from original in most use cases |
| 70 | 80-150 KB | Minor artifacts visible at full zoom |
| 50 | 40-80 KB | Noticeable artifacts, still readable for documents |
| 20 (minimum) | 15-30 KB | Significant artifacts, last resort |

For vision LLM use, quality 85 is the default because it produces files well within all provider size limits while preserving sufficient visual detail for the model to analyze. LLMs are generally robust to JPEG compression at quality 70+ for photographic content and quality 85+ for text-heavy content (documents, screenshots).

### PNG Compression

PNG is lossless -- the compression level (0-9) affects encoding speed and file size but not image quality. Level 6 (default) provides a good balance. PNG is preferred for screenshots, diagrams, and images with sharp text where JPEG artifacts would degrade readability.

### Format Selection

When `options.format` is not specified, `vision-prep` uses the input format unless it is unsupported by the target provider. The default format selection logic:

1. If the input format is supported by the provider, keep it.
2. If the input is BMP and the provider is not Gemini, convert to JPEG.
3. If `options.preferWebp` is true and the provider supports WebP, convert to WebP.
4. Otherwise, keep the input format.

When no format preference is specified, the package does not convert between JPEG and PNG. This avoids the lossy-to-lossless or lossless-to-lossy conversion tradeoff. The caller explicitly opts into format conversion via `options.format` or `options.preferWebp`.

### File Size Budget

If the compressed image exceeds the provider's file size limit, the package reduces JPEG/WebP quality iteratively:

```
quality_steps = [85, 75, 65, 55, 45, 35, 25, 20]

for each quality in quality_steps:
  compressed = compress(image, quality)
  if compressed.byteLength <= provider.maxFileSize:
    return compressed

throw ImageTooLargeError(...)
```

For PNG images that exceed the size limit, the package converts to JPEG (at quality 85, then iterates downward) since PNG cannot be quality-reduced without format conversion.

---

## 12. Configuration

### Default Values

| Option | Default | Description |
|---|---|---|
| `detail` | `'high'` | OpenAI detail mode. |
| `quality` | `85` | JPEG/WebP compression quality. |
| `format` | Input format | Output format. |
| `preferWebp` | `false` | Convert to WebP for smaller size. |
| `maxWidth` | Provider default | Maximum width override. |
| `maxHeight` | Provider default | Maximum height override. |
| `stripMetadata` | `true` | Remove EXIF data. |
| `backend` | `'sharp'` | Image processing backend. |
| `fetchTimeout` | `30_000` | URL fetch timeout (ms). |
| `concurrency` | `4` | Batch processing parallelism. |
| `continueOnError` | `false` | Continue batch on individual failure. |

### Provider Defaults

| Setting | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| Max file size | 20 MB | 5 MB | 20 MB |
| Max dimension (long side) | 2048 (high detail) | 1568 | 3600 |
| Default format | Input | Input | Input |

### No Configuration Files

`vision-prep` has no configuration files, environment variables, or initialization steps. Import and call:

```typescript
import { prepare } from 'vision-prep';
const result = await prepare('./photo.jpg', 'openai');
```

All behavior is controlled via function parameters.

---

## 13. CLI

### Installation and Invocation

```bash
# Global install
npm install -g vision-prep
vision-prep prepare openai ./photo.jpg

# npx (no install)
npx vision-prep prepare openai ./photo.jpg

# Package script
# package.json: { "scripts": { "prep-images": "vision-prep batch anthropic ./images/*.jpg" } }
npm run prep-images
```

### CLI Binary Name

`vision-prep`

### Commands

#### `vision-prep prepare <provider> <image> [options]`

Prepares a single image for a target provider.

```
Arguments:
  <provider>                 Target provider: openai, anthropic, gemini
  <image>                    Path to image file or URL

Options:
  --detail <mode>            OpenAI detail mode: low, high, auto. Default: high
  --quality <n>              JPEG/WebP quality (1-100). Default: 85
  --format <fmt>             Output format: jpeg, png, webp
  --max-width <n>            Override max width
  --max-height <n>           Override max height
  --model <model>            Model for cost estimation (e.g., gpt-4o)
  --output <path>            Write optimized image to file instead of stdout
  --base64                   Output base64 string to stdout
  --json                     Output full PreparedImage as JSON to stdout
  --quiet                    Suppress all output except errors

Meta:
  --version                  Print version and exit
  --help                     Print help and exit
```

#### `vision-prep batch <provider> <images...> [options]`

Prepares multiple images.

```
Arguments:
  <provider>                 Target provider
  <images...>                Paths to image files (supports globs)

Options:
  --concurrency <n>          Max parallel processing. Default: 4
  --continue-on-error        Don't stop on individual failures
  --output-dir <path>        Write optimized images to directory
  --json                     Output BatchResult as JSON to stdout
  (all options from prepare also apply)
```

#### `vision-prep estimate <provider> <image> [options]`

Estimates token cost without processing.

```
Arguments:
  <provider>                 Target provider
  <image>                    Path to image file or URL (or --dimensions)

Options:
  --dimensions <WxH>         Use explicit dimensions (e.g., 1920x1080)
  --detail <mode>            OpenAI detail mode. Default: high
  --model <model>            Model for cost estimation
  --json                     Output as JSON
```

### Human-Readable Output Examples

```
$ vision-prep prepare openai ./photo.jpg --detail high --model gpt-4o

  vision-prep v0.1.0

  Provider: OpenAI (detail: high)
  Model:    gpt-4o

  Original:   4000 x 3000  (3.1 MB, image/jpeg)
  Prepared:   1024 x 768   (187 KB, image/jpeg)
  Reduction:  94% file size reduction

  Tokens:     765
  Cost:       $0.001913

  Content block written to stdout (use --json for full output)
```

```
$ vision-prep estimate anthropic --dimensions 1920x1080

  vision-prep v0.1.0

  Provider:   Anthropic
  Dimensions: 1920 x 1080 -> 1568 x 882 (after resize)
  Tokens:     1,844
```

```
$ vision-prep batch openai ./documents/*.jpg --model gpt-4o --json --detail low

  {
    "succeeded": 12,
    "failed": 0,
    "totalTokens": 1020,
    "totalCost": 0.00255,
    "totalOriginalBytes": 37748736,
    "totalOptimizedBytes": 2359296,
    "images": [ ... ]
  }
```

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success. Image(s) prepared or estimate computed. |
| `1` | Processing error. Image could not be read, decoded, or processed. |
| `2` | Configuration error. Invalid flags, missing arguments, unsupported provider. |

---

## 14. Integration with Monorepo Packages

### Integration with `prompt-price`

`prompt-price` estimates the total cost of an LLM request including text tokens, tool definitions, and image tokens. `vision-prep` provides the image token count that `prompt-price` needs for accurate image cost estimation. The two packages are complementary: use `vision-prep` to prepare images and get per-image token counts, then pass those counts to `prompt-price` for total request cost estimation.

```typescript
import { prepare } from 'vision-prep';
import { estimate } from 'prompt-price';

const image = await prepare('./photo.jpg', 'openai', { detail: 'high' });

const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      image.contentBlock,
    ],
  },
];

const est = await estimate(messages, 'openai/gpt-4o', {
  estimatedOutputTokens: 500,
  defaultImageSize: { width: image.width, height: image.height },
});

console.log(`Total request cost: $${est.totalEstimatedCost.toFixed(4)}`);
```

### Integration with `model-price-registry`

`model-price-registry` provides per-model pricing data. When installed, `vision-prep` uses it to convert token estimates to dollar costs. The integration is optional: when `model-price-registry` is not installed, token estimates are still returned but dollar costs are `undefined`.

```typescript
import { prepare } from 'vision-prep';

// With model-price-registry installed
const result = await prepare('./photo.jpg', 'openai', { model: 'gpt-4o' });
console.log(result.cost);  // 0.001913

// Without model-price-registry
const result2 = await prepare('./photo.jpg', 'openai');
console.log(result2.cost);  // undefined
console.log(result2.tokens);  // 765 (tokens always available)
```

### Integration with `multimodal-msg`

`multimodal-msg` (this monorepo) constructs structured multimodal message arrays for LLM APIs. `vision-prep`'s `contentBlock` output is designed to be directly embeddable in the content arrays that `multimodal-msg` produces. The two packages can be composed: `multimodal-msg` handles message structure, `vision-prep` handles image preparation.

### Integration with `context-budget`

`context-budget` (this monorepo) manages context window allocation. When a context budget includes image inputs, `vision-prep`'s token estimates feed into the budget calculation to determine how many images can fit within the remaining context window.

```typescript
import { estimateTokens } from 'vision-prep';
import { allocateBudget } from 'context-budget';

const imageTokens = await estimateTokens({ width: 1920, height: 1080 }, 'openai', {
  detail: 'high',
});

const budget = allocateBudget({
  total: 128_000,
  reserved: { system: 500, tools: 2000, images: imageTokens.tokens * 5 },
});

console.log(`Remaining for text: ${budget.remaining} tokens`);
```

---

## 15. Testing Strategy

### Unit Tests

**Image source detection tests:**
- File path string is correctly identified (absolute, relative, with spaces).
- URL string starting with `http://` or `https://` is correctly identified.
- Data URL string starting with `data:image/` is correctly identified.
- Long base64 string without prefix is correctly identified.
- Short strings are treated as file paths, not base64.
- Buffer and Uint8Array inputs are accepted without detection.

**Resize calculation tests:**
- OpenAI low detail: various input sizes all produce dimensions within 512x512.
- OpenAI high detail: 4000x3000 produces 1024x768. 1920x1080 produces 1365x768. 800x600 passes through unchanged. 256x256 passes through unchanged.
- Anthropic: 4000x3000 triggers both longest-side and pixel-count constraints. 1920x1080 triggers longest-side constraint only. 1024x768 passes through unchanged.
- Gemini: 4000x3000 resizes to 3600x2700. 3000x2000 passes through unchanged.
- Aspect ratio is preserved for all resize operations (within 1px rounding).
- Images smaller than target dimensions are never upscaled.
- Custom maxWidth/maxHeight override provider defaults but provider ceiling still applies.

**Token estimation tests:**
- OpenAI low detail returns 85 for any dimensions.
- OpenAI high detail: verify against the worked examples in Section 8.
- Anthropic: verify against the worked examples in Section 8.
- Gemini returns 258 for any dimensions.
- Dollar cost calculation is correct when model pricing is available.
- Dollar cost is undefined when model-price-registry is not installed.

**Content block format tests:**
- OpenAI content block has correct structure with data URL prefix and detail mode.
- Anthropic content block has correct structure with raw base64 and media_type.
- Gemini content block has correct structure with mimeType and raw base64 data.
- MIME type in content block matches the actual encoded format.

**Image optimization tests:**
- JPEG quality parameter produces smaller files at lower quality.
- EXIF metadata is stripped when `stripMetadata: true`.
- PNG compression level affects file size but not dimensions.
- Format conversion from BMP to JPEG works.
- Format conversion from JPEG to WebP works when `preferWebp: true`.
- File size exceeding provider limit triggers quality reduction.
- Minimum quality (20) produces a file under the size limit for reasonable inputs.
- `ImageTooLargeError` is thrown when the image cannot be compressed below the limit.

**Batch processing tests:**
- All images in the batch are processed.
- Results are returned in the same order as inputs.
- `totalTokens` is the sum of individual `tokens` values.
- `concurrency` option limits parallel processing.
- `continueOnError: true` processes remaining images when one fails.
- `continueOnError: false` stops on first failure.
- Failed images are reported with error code and message.

**Error handling tests:**
- Non-existent file path throws `ImageNotFoundError`.
- Invalid URL throws `ImageFetchError`.
- Corrupted image data throws `InvalidImageError`.
- Invalid base64 string throws `InvalidBase64Error`.
- Unsupported provider string throws `UnsupportedProviderError`.

### Integration Tests

Integration tests use real image files (small test fixtures committed to the repo).

- Prepare a JPEG file for each provider and verify the output dimensions, token count, and content block format.
- Prepare a PNG file and verify PNG-specific behavior (lossless compression, no quality artifacts).
- Prepare a WebP file and verify it is accepted by all providers.
- Prepare a large image (4000x3000) and verify it is resized correctly per provider.
- Prepare a small image (64x64) and verify it is not upscaled.
- Fetch an image from a URL (use a local HTTP server in tests) and verify preparation.
- Prepare from a Buffer and verify identical output to file path preparation.
- Prepare from a base64 string and verify identical output.
- Batch-process 5 images and verify aggregate statistics.

### Edge Cases to Test

- Image with 1x1 dimensions.
- Image with extreme aspect ratio (10000x10, 10x10000).
- Image that is exactly at the provider's dimension limit (2048x2048 for OpenAI, 1568x1568 for Anthropic).
- Image at exactly the file size limit (5 MB for Anthropic).
- Animated GIF (should use first frame only, or pass through depending on provider).
- Image with EXIF orientation tag (rotated image should be handled correctly after metadata strip).
- Empty Buffer input.
- URL that returns a 404.
- URL that returns HTML instead of an image.
- URL that times out.
- Concurrent `prepare()` calls with the same image (no file locking issues).

### Test Framework

Tests use Vitest, matching the project's existing configuration. Test image fixtures are stored in `src/__tests__/fixtures/` and include:

- `photo.jpg` -- 4000x3000 JPEG (can be a minimal valid JPEG, not a real photo)
- `icon.png` -- 64x64 PNG
- `screenshot.png` -- 1920x1080 PNG
- `small.webp` -- 256x256 WebP
- `diagram.bmp` -- 800x600 BMP
- `corrupted.jpg` -- invalid JPEG data for error testing

Test fixtures should be as small as possible (valid image headers with minimal pixel data) to keep the repository lightweight.

---

## 16. Performance

### Processing Speed

Image processing speed depends on the backend and image size:

**sharp (default, libvips-based):**

| Operation | 4000x3000 JPEG | 1024x768 JPEG | 256x256 PNG |
|---|---|---|---|
| Read + metadata | ~5 ms | ~2 ms | ~1 ms |
| Resize | ~15 ms | ~5 ms | ~2 ms |
| Compress (JPEG q85) | ~10 ms | ~5 ms | ~2 ms |
| Base64 encode | ~3 ms | ~1 ms | <1 ms |
| **Total per image** | **~33 ms** | **~13 ms** | **~5 ms** |

**jimp (pure JavaScript fallback):**

| Operation | 4000x3000 JPEG | 1024x768 JPEG | 256x256 PNG |
|---|---|---|---|
| Read + decode | ~200 ms | ~50 ms | ~20 ms |
| Resize | ~500 ms | ~100 ms | ~10 ms |
| Compress | ~300 ms | ~80 ms | ~15 ms |
| Base64 encode | ~3 ms | ~1 ms | <1 ms |
| **Total per image** | **~1003 ms** | **~231 ms** | **~45 ms** |

`sharp` is 10-30x faster than `jimp` for typical image sizes. `sharp` is strongly recommended for production use. `jimp` is suitable for development, testing, or environments where native dependencies cannot be installed.

### Batch Throughput

With `sharp` and `concurrency: 4` on a 4-core machine:

| Batch size | Image size | Total time | Images/second |
|---|---|---|---|
| 10 | 1024x768 | ~40 ms | ~250 |
| 100 | 1024x768 | ~350 ms | ~285 |
| 10 | 4000x3000 | ~100 ms | ~100 |
| 100 | 4000x3000 | ~900 ms | ~111 |

### Memory Usage

`sharp` streams images through libvips and does not load the full uncompressed bitmap into Node.js memory. A 4000x3000 JPEG (36 MB uncompressed) uses approximately 50-100 MB of native memory during processing, which is freed immediately after the operation completes.

`jimp` loads the full bitmap into JavaScript heap memory. A 4000x3000 image at 4 bytes per pixel consumes 36 MB of heap memory. With `concurrency: 4`, peak memory is 4 x 36 MB = 144 MB. For large batches, consider reducing concurrency.

### Token Estimation Performance

Token estimation without image processing (using `estimateTokens` with explicit dimensions) is pure arithmetic: three comparisons, two multiplications, one ceiling operation. Under 0.001 ms per call.

---

## 17. Dependencies

### Runtime Dependencies

| Dependency | Type | Purpose | Why Not Avoid It |
|---|---|---|---|
| `sharp` | peer (optional) | Image reading, resizing, compression, format conversion. High-performance C++ bindings to libvips. | `sharp` is the de facto standard for image processing in Node.js. It is 10-30x faster than pure JavaScript alternatives, handles all required formats, and manages memory efficiently through streaming. Making it a peer dependency lets callers control the version and avoids bundling native binaries. |

### Optional Dependencies

| Dependency | Type | Purpose | Why Not Avoid It |
|---|---|---|---|
| `model-price-registry` | optional peer | Provides per-model pricing data for dollar cost estimation. | This is the monorepo's pricing source of truth. When installed, `vision-prep` can convert token estimates to dollar amounts. When absent, token estimates are still returned without cost data. |

### No Other Runtime Dependencies

Image format detection uses magic byte inspection (inline implementation reading the first 8-16 bytes). Base64 encoding uses Node.js built-in `Buffer.toString('base64')`. URL fetching uses Node.js built-in `fetch()` (Node.js 18+). CLI argument parsing uses `util.parseArgs` (Node.js 18+). No HTTP framework, CLI library, or utility library is required at runtime.

### Dev Dependencies

| Dependency | Purpose |
|---|---|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter. |
| `sharp` | Dev dependency for tests (also peer dependency). |

---

## 18. File Structure

```
vision-prep/
├── src/
│   ├── index.ts                  # Public API exports
│   ├── prepare.ts                # prepare(), prepareForOpenAI/Anthropic/Gemini()
│   ├── estimate.ts               # estimateTokens()
│   ├── batch.ts                  # prepareBatch()
│   ├── factory.ts                # createPreparer()
│   ├── pipeline/
│   │   ├── read.ts               # Step 1: read image from source
│   │   ├── detect.ts             # Step 2: detect format and dimensions
│   │   ├── resize.ts             # Step 3: provider-specific resize
│   │   ├── optimize.ts           # Step 4: compress and format convert
│   │   ├── encode.ts             # Step 5: base64 encoding
│   │   └── tokens.ts             # Step 6: token cost estimation
│   ├── providers/
│   │   ├── openai.ts             # OpenAI resize strategy, token formula, content block
│   │   ├── anthropic.ts          # Anthropic resize strategy, token formula, content block
│   │   └── gemini.ts             # Gemini resize strategy, token formula, content block
│   ├── backends/
│   │   ├── sharp.ts              # sharp backend adapter
│   │   └── jimp.ts               # jimp backend adapter (fallback)
│   ├── errors.ts                 # ImageNotFoundError, InvalidImageError, etc.
│   ├── types.ts                  # All TypeScript interfaces and types
│   ├── cli.ts                    # CLI entry point
│   └── __tests__/
│       ├── prepare.test.ts       # prepare() and per-provider convenience function tests
│       ├── estimate.test.ts      # estimateTokens() tests
│       ├── batch.test.ts         # prepareBatch() tests
│       ├── factory.test.ts       # createPreparer() tests
│       ├── resize.test.ts        # Resize strategy tests for all providers
│       ├── tokens.test.ts        # Token formula tests with worked examples
│       ├── optimize.test.ts      # Compression and format conversion tests
│       ├── read.test.ts          # Image source reading tests
│       ├── content-block.test.ts # Provider content block format tests
│       ├── cli.test.ts           # CLI integration tests
│       └── fixtures/
│           ├── photo.jpg         # 4000x3000 JPEG
│           ├── icon.png          # 64x64 PNG
│           ├── screenshot.png    # 1920x1080 PNG
│           ├── small.webp        # 256x256 WebP
│           ├── diagram.bmp       # 800x600 BMP
│           └── corrupted.jpg     # Invalid JPEG for error testing
├── package.json
├── tsconfig.json
└── SPEC.md
```

---

## 19. Implementation Roadmap

### Phase 1: Core Pipeline (v0.1.0)

1. **Types and errors** -- Define all TypeScript interfaces (`PreparedImage`, `TokenEstimate`, `PrepareOptions`, provider content block types) and error classes (`ImageNotFoundError`, `InvalidImageError`, `ImageTooLargeError`, `UnsupportedProviderError`, `InvalidBase64Error`, `ImageFetchError`).
2. **Provider modules** -- Implement resize strategies and token formulas for OpenAI, Anthropic, and Gemini. Each provider module exports `resize(width, height, options)`, `estimateTokens(width, height, options)`, and `formatContentBlock(base64, mimeType, options)`.
3. **Image reading** -- Implement `read.ts` with support for file paths, URLs, Buffers, and base64 strings. Implement source type detection logic.
4. **Sharp backend** -- Implement `backends/sharp.ts` wrapping `sharp` for metadata extraction, resize, and compression. Implement format detection from magic bytes.
5. **Pipeline orchestration** -- Implement the seven-step pipeline in `prepare.ts`. Wire up read, detect, resize, optimize, encode, and token estimation.
6. **`prepare()` and convenience functions** -- Export `prepare`, `prepareForOpenAI`, `prepareForAnthropic`, `prepareForGemini`.
7. **`estimateTokens()`** -- Implement dimension-only token estimation without the full pipeline.
8. **Unit tests** -- Write tests for resize calculations, token formulas, content block formats, and source detection.

### Phase 2: Batch and Factory (v0.2.0)

1. **`prepareBatch()`** -- Implement parallel batch processing with configurable concurrency using a simple semaphore pattern.
2. **`createPreparer()`** -- Implement the factory function that returns a pre-configured `ImagePreparer` instance.
3. **`model-price-registry` integration** -- Add optional dollar cost estimation when the registry is installed.
4. **Integration tests** -- Write tests with real image fixtures for all providers and input types.

### Phase 3: CLI (v0.3.0)

1. **CLI argument parsing** -- Parse `prepare`, `batch`, and `estimate` commands with `util.parseArgs`.
2. **CLI output formatting** -- Implement human-readable and JSON output modes.
3. **CLI integration tests** -- Test CLI commands with subprocess execution.

### Phase 4: Polish (v0.4.0)

1. **Jimp fallback backend** -- Implement `backends/jimp.ts` for environments without native dependencies.
2. **File size budget** -- Implement iterative quality reduction when compressed images exceed provider limits.
3. **URL fetching** -- Add timeout, redirect following, and content-type validation for URL inputs.
4. **Edge case handling** -- Handle animated GIFs, EXIF orientation, extreme aspect ratios.
5. **Performance benchmarks** -- Measure and document processing speed for sharp vs jimp.

---

## 20. Example Use Cases

### 20.1 Document Analysis Pipeline

A document processing system photographs multi-page documents with a high-resolution camera and sends each page to Claude for data extraction.

```typescript
import { prepareBatch } from 'vision-prep';

const pageImages = [
  './scans/page1.jpg',  // 4000x3000, 3.5 MB
  './scans/page2.jpg',
  './scans/page3.jpg',
  './scans/page4.jpg',
];

const batch = await prepareBatch(pageImages, 'anthropic', {
  quality: 85,
  model: 'claude-sonnet-4-5',
  concurrency: 4,
});

console.log(`Prepared ${batch.succeeded} pages`);
console.log(`Total tokens: ${batch.totalTokens}`);
console.log(`Total cost: $${batch.totalCost?.toFixed(4)}`);
console.log(`File size: ${(batch.totalOriginalBytes / 1024 / 1024).toFixed(1)} MB -> ${(batch.totalOptimizedBytes / 1024 / 1024).toFixed(1)} MB`);

// Build messages array with all pages
const content = [
  { type: 'text', text: 'Extract all invoice line items from these pages.' },
  ...batch.images
    .filter((img): img is PreparedImage => 'base64' in img)
    .map(img => img.contentBlock),
];
```

### 20.2 Product Image Analysis

An e-commerce platform sends product photos to GPT-4o for automatic description generation. Using `detail: "low"` saves 9x on token costs when the product image is a simple product-on-white-background shot.

```typescript
import { createPreparer } from 'vision-prep';

const preparer = createPreparer({
  provider: 'openai',
  detail: 'low',  // 85 tokens vs 765+ for high
  quality: 80,
  model: 'gpt-4o',
});

// Process 1000 product images
const products = await loadProductImages();  // string[]
let totalCost = 0;

for (const imagePath of products) {
  const prepared = await preparer.prepare(imagePath);
  totalCost += prepared.cost ?? 0;

  // Send to OpenAI
  await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Write a product description.' },
        prepared.contentBlock,
      ],
    }],
  });
}

console.log(`Total image cost for ${products.length} products: $${totalCost.toFixed(2)}`);
// At low detail: 1000 * $0.000213 = $0.21
// At high detail: 1000 * $0.001913 = $1.91 (9x more)
```

### 20.3 Screenshot Processing for Bug Reports

A QA tool captures screenshots of UI bugs and sends them to an LLM for initial triage. Screenshots are typically 1920x1080 PNG files with sharp text that benefits from PNG format preservation.

```typescript
import { prepareForAnthropic } from 'vision-prep';

const screenshot = await prepareForAnthropic('./bug-screenshot.png', {
  format: 'png',  // preserve PNG for text clarity
  model: 'claude-sonnet-4-5',
});

console.log(`Screenshot: ${screenshot.original.width}x${screenshot.original.height} -> ${screenshot.width}x${screenshot.height}`);
console.log(`Tokens: ${screenshot.tokens}, Cost: $${screenshot.cost?.toFixed(4)}`);

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250514',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Describe the UI bug visible in this screenshot. Identify the component, expected behavior, and actual behavior.' },
      screenshot.contentBlock,
    ],
  }],
});
```

### 20.4 Multi-Provider Cost Comparison

A developer evaluates which provider gives the best cost-per-image for their use case before committing to one.

```typescript
import { estimateTokens } from 'vision-prep';

const imageDimensions = { width: 1920, height: 1080 };

const providers = [
  { provider: 'openai' as const, model: 'gpt-4o', detail: 'high' as const },
  { provider: 'openai' as const, model: 'gpt-4o', detail: 'low' as const },
  { provider: 'anthropic' as const, model: 'claude-sonnet-4-5' },
  { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
  { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
];

console.log('Cost comparison for 1920x1080 image:');
for (const { provider, model, detail } of providers) {
  const est = await estimateTokens(imageDimensions, provider, { detail, model });
  console.log(`  ${provider} (${model}${detail ? ', ' + detail : ''}): ${est.tokens} tokens, $${est.cost?.toFixed(6)}`);
}

// Output:
//   openai (gpt-4o, high): 1105 tokens, $0.002763
//   openai (gpt-4o, low): 85 tokens, $0.000213
//   anthropic (claude-sonnet-4-5): 1844 tokens, $0.005532
//   gemini (gemini-2.5-flash): 258 tokens, $0.000039
//   gemini (gemini-2.5-pro): 258 tokens, $0.000323
```

### 20.5 CLI Batch Optimization

A developer optimizes a directory of images for Anthropic before uploading to a data pipeline.

```bash
$ vision-prep batch anthropic ./training-images/*.jpg \
    --output-dir ./optimized/ \
    --quality 80 \
    --model claude-sonnet-4-5 \
    --json

{
  "succeeded": 47,
  "failed": 0,
  "totalTokens": 89234,
  "totalCost": 0.267702,
  "totalOriginalBytes": 156237824,
  "totalOptimizedBytes": 14680064,
  "images": [...]
}

# 149 MB -> 14 MB (91% reduction)
# 47 images * ~1899 tokens/image average
```
