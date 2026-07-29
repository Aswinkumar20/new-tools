import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const ARCHIVE_JSZIP_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

export const ARCHIVE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.z',
  '.cab',
  '.iso',
  '.apk',
  '.jar',
  '.war',
  '.ear'
];

export const ARCHIVE_FULLY_SUPPORTED_EXTENSION = '.zip';

export const ARCHIVE_ACCEPT_ATTR = ARCHIVE_SUPPORTED_EXTENSIONS.join(',');

export const ARCHIVE_IMAGE_EXTENSIONS: ReadonlyArray<string> = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg'
];

export const ARCHIVE_TEXT_EXTENSIONS: ReadonlyArray<string> = [
  'txt',
  'md',
  'json',
  'xml',
  'html',
  'css',
  'js',
  'ts',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'log',
  'csv',
  'yml',
  'yaml'
];

export const ARCHIVE_FILE_ICON_MAP: Readonly<Record<string, string>> = {
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  bmp: '🖼️',
  webp: '🖼️',
  svg: '🖼️',
  txt: '📄',
  md: '📝',
  doc: '📄',
  docx: '📄',
  pdf: '📕',
  zip: '📦',
  rar: '📦',
  '7z': '📦',
  mp3: '🎵',
  mp4: '🎬',
  avi: '🎬',
  js: '📜',
  ts: '📜',
  json: '📜',
  html: '🌐',
  css: '🎨',
  xml: '📋'
};

export const ARCHIVE_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Open extracted text payloads with richer line tools'
  },
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect image assets pulled from ZIP packs'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Check MIME type and size before unpacking'
  },
  {
    label: '3D Model Viewer',
    path: '/file-viewers/3d-model-viewer',
    description: 'Next step for GLTF/OBJ kits found inside archives'
  }
];
