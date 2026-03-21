// vision-prep - Resize and optimize images for vision LLM APIs

// Core functions
export {
  prepare,
  prepareForOpenAI,
  prepareForAnthropic,
  prepareForGemini,
  estimateTokens,
  prepareBatch,
  createPreparer,
} from './prepare';

// Format detection
export { detectFormat, extractDimensions, getImageInfo, formatToMimeType } from './detect';

// Token estimation
export {
  estimateOpenAITokens,
  estimateAnthropicTokens,
  estimateGeminiTokens,
  estimateTokensFromDimensions,
  openAIHighDetailResize,
  anthropicResize,
  getProviderResizedDimensions,
} from './tokens';

// Provider formatters
export {
  formatOpenAIContentBlock,
  formatAnthropicContentBlock,
  formatGeminiContentBlock,
  formatContentBlock,
  getMaxFileSize,
  isFormatSupported,
} from './providers';

// Types
export type {
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
} from './types';
