import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';

export const FILE_METADATA_ADDITIONAL_INFO_LABELS: Readonly<Record<string, string>> = {
  lines: 'Lines',
  characters: 'Characters',
  words: 'Words'
};

export const FILE_METADATA_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav'
};

export const FILE_METADATA_ICONS_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  pdf: '📄',
  doc: '📄',
  docx: '📄',
  txt: '📝',
  html: '🌐',
  css: '🎨',
  js: '💻',
  json: '📋',
  xml: '📋',
  zip: '📦',
  rar: '📦',
  mp4: '🎬',
  mp3: '🎵',
  wav: '🎵'
};

export const FILE_METADATA_DEFAULT_ICON = '📁';

export const FILE_METADATA_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export const FILE_METADATA_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'Image to Base64',
    path: '/image-color-tools/image-to-base64',
    description: 'Encode image files as Base64 data URLs'
  },
  {
    label: 'Image Resizer',
    path: '/image-color-tools/image-resizer',
    description: 'Resize images using detected dimensions'
  },
  {
    label: 'PDF Metadata Editor',
    path: '/pdf-tools/pdf-metadata-editor',
    description: 'Edit PDF document properties'
  },
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Checksum files for integrity checks'
  },
  {
    label: 'CSS Minifier',
    path: '/code-file-tools/css-minifier',
    description: 'Minify CSS stylesheets after inspection'
  }
];
