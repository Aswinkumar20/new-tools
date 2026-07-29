import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { ImageResizePreset } from '../types/image-resizer.types';

export const IMAGE_RESIZER_MAX_DIMENSION = 8000;

export const IMAGE_RESIZER_MAX_FILE_SIZE = 35 * 1024 * 1024;

export const IMAGE_RESIZER_HISTORY_LIMIT = 10;

export const IMAGE_RESIZER_DEFAULT_QUALITY = 0.92;

export const IMAGE_RESIZER_PRESETS: ReadonlyArray<ImageResizePreset> = [
  { label: '1080p HD', description: '1920 × 1080', width: 1920, height: 1080, lockAspect: true },
  { label: 'Instagram Post', description: '1080 × 1080', width: 1080, height: 1080, lockAspect: true },
  { label: 'Instagram Story', description: '1080 × 1920', width: 1080, height: 1920, lockAspect: true },
  { label: 'Twitter Header', description: '1500 × 500', width: 1500, height: 500, lockAspect: true },
  { label: 'YouTube Thumbnail', description: '1280 × 720', width: 1280, height: 720, lockAspect: true },
  { label: 'Favicon', description: '64 × 64', width: 64, height: 64, lockAspect: false }
];

export const IMAGE_RESIZER_ERROR = {
  invalidImage: 'Please upload a valid image file.',
  loadFailed: 'Unable to load the selected image.',
  invalidDimensions: 'Please provide valid target width and height.',
  encodeFailed: 'Unable to encode resized image.',
  contextFailed: 'Unable to create rendering context.'
} as const;

export const IMAGE_RESIZER_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink file size after resizing'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the resized asset as a data URL'
  },
  {
    label: 'Favicon Generator',
    path: '/image-color-tools/favicon-generator',
    description: 'Build icons from a small resized image'
  },
  {
    label: 'Palette Generator',
    path: '/image-color-tools/palette-generator',
    description: 'Extract colors from the original image'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch a new asset when you need a blank canvas'
  }
];
