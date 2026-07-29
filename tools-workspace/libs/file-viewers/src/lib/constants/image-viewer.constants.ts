import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const IMAGE_SUPPORTED_MIME_TYPES: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/ico',
  'image/avif',
  'image/apng',
  'image/x-png',
  'image/x-jpeg',
  'image/x-bmp',
  'image/x-windows-bmp',
  'image/x-ms-bmp',
  'image/vnd.adobe.photoshop',
  'image/x-portable-pixmap',
  'image/x-portable-graymap',
  'image/x-portable-bitmap',
  'image/x-xpixmap',
  'image/x-xbitmap'
];

export const IMAGE_UNIVERSALLY_SUPPORTED_MIME_TYPES: ReadonlyArray<string> = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp'
];

/** Formats that might have limited browser support — currently empty (preserved). */
export const IMAGE_LIMITED_BROWSER_SUPPORT_MIME_TYPES: ReadonlyArray<string> = [];

export const IMAGE_EXTENSION_MIME_MAP: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  apng: 'image/apng',
  psd: 'image/vnd.adobe.photoshop',
  ppm: 'image/x-portable-pixmap',
  pgm: 'image/x-portable-graymap',
  pbm: 'image/x-portable-bitmap',
  xpm: 'image/x-xpixmap',
  xbm: 'image/x-xbitmap'
};

export const IMAGE_FILE_EXTENSIONS: ReadonlyArray<string> = Object.keys(IMAGE_EXTENSION_MIME_MAP);

export const IMAGE_ACCEPT_ATTR = 'image/*';

export const IMAGE_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const IMAGE_MAX_FILE_SIZE_LABEL = '50MB';

export const IMAGE_DEFAULT_ZOOM = 100;
export const IMAGE_MIN_ZOOM = 25;
export const IMAGE_MAX_ZOOM = 500;
export const IMAGE_ZOOM_STEP = 25;

export const IMAGE_THUMBNAIL_SCROLL_AMOUNT = 300;
export const IMAGE_VERIFY_TIMEOUT_MS = 10000;
export const IMAGE_DOWNLOAD_STAGGER_MS = 100;
export const IMAGE_FULLSCREEN_RENDER_DELAY_MS = 100;
export const IMAGE_FIT_AFTER_FULLSCREEN_MS = 150;

export const IMAGE_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const IMAGE_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Image Compressor',
    path: '/image-color-tools/image-compressor',
    description: 'Shrink large uploads before sharing or embedding'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Export exact pixel dimensions for web and social'
  },
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Embed previews as data URIs in CSS or HTML'
  },
  {
    label: 'Image to PDF',
    path: '/pdf-tools/image-to-pdf',
    description: 'Bundle a gallery into a printable PDF'
  },
  {
    label: 'Color Picker',
    path: '/image-color-tools/color-picker',
    description: 'Sample brand colors from screenshots and artwork'
  }
];
