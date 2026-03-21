# vision-prep

Prepare images for vision LLM APIs -- detect format, extract dimensions, estimate tokens, and generate provider-formatted content blocks for OpenAI, Anthropic, and Gemini.

## Install

```bash
npm install vision-prep
```

## Quick Start

```typescript
import { prepare, estimateTokens } from 'vision-prep';

// Prepare an image for OpenAI
const result = await prepare(imageBuffer, 'openai', { detail: 'high' });
console.log(result.tokens);       // 765
console.log(result.mimeType);     // 'image/jpeg'
console.log(result.contentBlock); // Ready for messages array

// Estimate tokens without processing
const est = await estimateTokens({ width: 1920, height: 1080 }, 'openai', { detail: 'high' });
console.log(est.tokens); // 1105
```

## Features

- **Format detection** from magic bytes (PNG, JPEG, GIF, WebP, BMP)
- **Dimension extraction** from image headers without full decode
- **Token estimation** using each provider's documented formula
  - OpenAI: tile-based (170/tile + 85 base), low detail = 85 flat
  - Anthropic: pixel-based (width * height / 750)
  - Gemini: flat 258 per image
- **Provider content blocks** formatted for direct API use
- **Zero runtime dependencies** -- pure Node.js
- **TypeScript** with strict mode, full type exports

## API

### `prepare(image, provider, options?)`

Reads an image, detects format, extracts dimensions, estimates tokens, encodes to base64, and returns a `PreparedImage` with a provider-formatted content block.

```typescript
const result = await prepare('./photo.jpg', 'openai', { detail: 'high' });
```

**Image sources:** `Buffer`, `Uint8Array`, file path, URL, base64 string, or data URL.

**Providers:** `'openai'` | `'anthropic'` | `'gemini'`

### `prepareForOpenAI(image, options?)`

Convenience wrapper for `prepare(image, 'openai', options)`.

### `prepareForAnthropic(image, options?)`

Convenience wrapper for `prepare(image, 'anthropic', options)`.

### `prepareForGemini(image, options?)`

Convenience wrapper for `prepare(image, 'gemini', options)`.

### `estimateTokens(image, provider, options?)`

Calculate token cost from dimensions or an image source without full processing.

```typescript
// From dimensions
const est = await estimateTokens({ width: 1024, height: 768 }, 'anthropic');
// From buffer
const est2 = await estimateTokens(buffer, 'openai', { detail: 'high' });
```

### `prepareBatch(images, provider, options?)`

Process multiple images in parallel with aggregate token/cost reporting.

```typescript
const batch = await prepareBatch([buf1, buf2, buf3], 'anthropic', { concurrency: 4 });
console.log(batch.totalTokens);
console.log(batch.succeeded, batch.failed);
```

### `createPreparer(config)`

Factory for a pre-configured preparer instance.

```typescript
const prep = createPreparer({ provider: 'openai', detail: 'high' });
const result = await prep.prepare(buffer);
```

### `detectFormat(buffer)`

Detect image format from magic bytes. Returns `'jpeg'` | `'png'` | `'gif'` | `'webp'` | `'bmp'` | `null`.

### `estimateOpenAITokens(width, height, detail?)`

Direct OpenAI token calculation.

### `estimateAnthropicTokens(width, height)`

Direct Anthropic token calculation.

### `estimateGeminiTokens(width, height)`

Direct Gemini token calculation (always 258).

## Token Formulas

| Provider | Formula | Low-cost mode |
|----------|---------|---------------|
| OpenAI | `ceil(w/512) * ceil(h/512) * 170 + 85` (after resize) | `detail: 'low'` = 85 flat |
| Anthropic | `ceil(w*h / 750)` (after resize) | N/A |
| Gemini | 258 flat | N/A |

## Content Block Formats

**OpenAI:**
```json
{ "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,...", "detail": "high" } }
```

**Anthropic:**
```json
{ "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": "..." } }
```

**Gemini:**
```json
{ "inlineData": { "mimeType": "image/jpeg", "data": "..." } }
```

## License

MIT
