import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';

export const IMAGE_TO_BASE64_DEFAULT_WRAP_WIDTH = 76;

export const IMAGE_TO_BASE64_DEFAULT_CHUNK_SIZE = 4096;

export const IMAGE_TO_BASE64_MIN_CHUNK_SIZE = 256;

export const IMAGE_TO_BASE64_MAX_FILE_SIZE = 25 * 1024 * 1024;

export const IMAGE_TO_BASE64_HISTORY_LIMIT = 8;

export const IMAGE_TO_BASE64_FALLBACK_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'icns',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
  'raw',
  'cr2',
  'nef',
  'arw',
  'dng'
]);

export const IMAGE_TO_BASE64_ERROR = {
  processFailed: 'Failed to process file',
  clipboardDenied: 'Clipboard access denied.'
} as const;

export const IMAGE_TO_BASE64_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink the image before embedding to cut payload size'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Reduce dimensions for lighter Base64 strings'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Create small icons that embed cleanly as data URIs'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Extract colors when you need CSS tokens instead of pixels'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch a simple asset, then encode it here'
  }
];
