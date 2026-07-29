import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { ImageCompressionPreset } from '../types/image-compressor.types';

export const IMAGE_COMPRESSOR_MAX_DIMENSION = 8000;

export const IMAGE_COMPRESSOR_MAX_FILE_SIZE = 45 * 1024 * 1024;

export const IMAGE_COMPRESSOR_HISTORY_LIMIT = 10;

export const IMAGE_COMPRESSOR_DEFAULT_QUALITY = 0.8;

export const IMAGE_COMPRESSOR_PRESETS: ReadonlyArray<ImageCompressionPreset> = [
  { label: 'High quality JPEG', description: 'Quality 0.85', quality: 0.85, format: 'image/jpeg' },
  { label: 'Balanced WebP', description: 'Quality 0.7', quality: 0.7, format: 'image/webp' },
  { label: 'Lightweight WebP', description: 'Quality 0.5', quality: 0.5, format: 'image/webp' }
];

export const IMAGE_COMPRESSOR_ERROR = {
  invalidImage: 'Please upload a valid image file.',
  loadFailed: 'Unable to load the selected image.',
  qualityRange: 'Quality must be between 0.1 and 1.',
  invalidDimensions: 'Please provide valid resize dimensions.',
  encodeFailed: 'Unable to encode compressed image.',
  contextFailed: 'Unable to create rendering context.'
} as const;

export const IMAGE_COMPRESSOR_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Resize with more control before compressing'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the compressed file as a data URL'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Turn a small asset into site icons'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Extract colors from the original image'
  },
  {
    label: 'Image to Text',
    path: '/image-color-tools/image-to-text',
    description: 'OCR text from screenshots or photos'
  }
];
