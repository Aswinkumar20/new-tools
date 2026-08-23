import type { TfRelatedToolLink } from '../types/tiff-viewer.types';

export const TF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.tif', '.tiff', '.txt', '.json', '.csv', '.md'];

export const TF_ACCEPT_ATTR =
  '.tif,.tiff,.txt,.json,.csv,.md,image/tiff,image/tif,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const TF_FORMATS_LABEL = '.tif, .tiff, .json, .csv, .md, .txt';

export const TF_FORMATS_HINT = 'Multi-page TIFF preview and zoom. Education/research only.';

export const TF_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const TF_RELATED_TOOLS: ReadonlyArray<TfRelatedToolLink> = [
  { label: 'HEIC Viewer', description: 'Apple HEIC preview', path: '/file-viewers/heic-viewer' },
  { label: 'RAW Image Viewer', description: 'Camera RAW preview', path: '/file-viewers/raw-image-viewer' },
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' },
  { label: 'PSD Viewer', description: 'Photoshop layers', path: '/file-viewers/psd-viewer' }
];
