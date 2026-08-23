import type { RwRelatedToolLink } from '../types/raw-image-viewer.types';

export const RW_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.cr2',
  '.nef',
  '.arw',
  '.dng',
  '.raw',
  '.txt',
  '.json',
  '.csv',
  '.md'
];

export const RW_ACCEPT_ATTR =
  '.cr2,.nef,.arw,.dng,.raw,.txt,.json,.csv,.md,image/x-canon-cr2,image/x-nikon-nef,image/x-sony-arw,image/x-adobe-dng,image/x-raw,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const RW_FORMATS_LABEL = '.cr2, .nef, .arw, .dng, .raw, .json, .csv, .md, .txt';

export const RW_FORMATS_HINT = 'Camera RAW demosaic preview and EXIF. Education/research only.';

export const RW_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const RW_RELATED_TOOLS: ReadonlyArray<RwRelatedToolLink> = [
  { label: 'HEIC Viewer', description: 'Apple HEIC preview', path: '/file-viewers/heic-viewer' },
  { label: 'TIFF Viewer', description: 'Multi-page TIFF', path: '/file-viewers/tiff-viewer' },
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' },
  { label: 'PSD Viewer', description: 'Photoshop layers', path: '/file-viewers/psd-viewer' }
];
