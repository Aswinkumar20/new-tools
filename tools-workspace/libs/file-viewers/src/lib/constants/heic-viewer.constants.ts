import type { HcRelatedToolLink } from '../types/heic-viewer.types';

export const HC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.heic', '.heif', '.txt', '.json', '.csv', '.md'];

export const HC_ACCEPT_ATTR =
  '.heic,.heif,.txt,.json,.csv,.md,image/heic,image/heif,image/heic-sequence,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const HC_FORMATS_LABEL = '.heic, .heif, .json, .csv, .md, .txt';

export const HC_FORMATS_HINT = 'HEIC decode preview and export. Education/research only.';

export const HC_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const HC_RELATED_TOOLS: ReadonlyArray<HcRelatedToolLink> = [
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' },
  { label: 'TIFF Viewer', description: 'Multi-page TIFF', path: '/file-viewers/tiff-viewer' },
  { label: 'RAW Image Viewer', description: 'Camera RAW preview', path: '/file-viewers/raw-image-viewer' },
  { label: 'PSD Viewer', description: 'Photoshop layers', path: '/file-viewers/psd-viewer' }
];
