import type { PdRelatedToolLink } from '../types/psd-viewer.types';

export const PD_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.psd', '.txt', '.json', '.csv', '.md'];

export const PD_ACCEPT_ATTR =
  '.psd,.txt,.json,.csv,.md,image/vnd.adobe.photoshop,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const PD_FORMATS_LABEL = '.psd, .json, .csv, .md, .txt';

export const PD_FORMATS_HINT = 'PSD layers and preview. Education/research only.';

export const PD_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const PD_RELATED_TOOLS: ReadonlyArray<PdRelatedToolLink> = [
  { label: 'SVG Viewer', description: 'Vector zoom and source', path: '/file-viewers/svg-viewer' },
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' },
  { label: 'AI File Viewer', description: 'Illustrator preview', path: '/file-viewers/ai-file-viewer' },
  { label: 'TIFF Viewer', description: 'Multi-page TIFF', path: '/file-viewers/tiff-viewer' }
];
