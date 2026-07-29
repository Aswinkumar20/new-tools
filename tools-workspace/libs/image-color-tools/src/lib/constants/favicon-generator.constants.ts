import type { IctRelatedToolLink } from '../shared/ict-tool-suggestion.model';
import type { FaviconDefaults, FaviconSize } from '../types/favicon-generator.types';

export const FAVICON_DEBOUNCE_MS = 200;

export const FAVICON_INIT_DELAY_MS = 100;

export const FAVICON_RETRY_DELAY_MS = 100;

export const FAVICON_HISTORY_LIMIT = 10;

export const FAVICON_ALL_SIZES_STAGGER_MS = 10;

export const FAVICON_SIZES: ReadonlyArray<FaviconSize> = [
  16, 32, 48, 64, 96, 128, 180, 192, 512
];

export const FAVICON_FONT_FAMILIES: ReadonlyArray<string> = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Palatino',
  'Garamond',
  'Comic Sans MS',
  'Impact',
  'Trebuchet MS',
  'Lucida Console',
  'Monaco',
  'Menlo'
];

export const FAVICON_DEFAULTS: FaviconDefaults = {
  mode: 'text',
  text: 'F',
  fontSize: 80,
  fontFamily: 'Arial',
  backgroundColor: '#007bff',
  textColor: '#ffffff',
  emoji: '⭐',
  size: 32,
  format: 'png'
};

export const FAVICON_ERROR = {
  invalidImage: 'Please select a valid image file.',
  loadImage: 'Failed to load image.',
  readFile: 'Failed to read file.',
  noCanvas: 'Canvas context not available.',
  noImage: 'No image uploaded.',
  copyHtml: 'Unable to copy HTML code to clipboard.'
} as const;

export const FAVICON_RELATED_TOOLS: ReadonlyArray<IctRelatedToolLink> = [
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Pick background and text colors precisely'
  },
  {
    label: 'Drawing Pad',
    path: '/image-color-tools/drawing-pad',
    description: 'Sketch a custom icon, then upload it here'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Prepare source images before favicon export'
  },
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink exported PNG favicons for production'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed the favicon data URL in CSS or HTML'
  }
];
