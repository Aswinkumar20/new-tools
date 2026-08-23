import type { SvRelatedToolLink } from '../types/svg-viewer.types';

export const SV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.svg', '.txt', '.json', '.csv', '.md'];

export const SV_ACCEPT_ATTR =
  '.svg,.txt,.json,.csv,.md,image/svg+xml,application/json,text/plain,text/csv,text/markdown,text/xml';

export const SV_FORMATS_LABEL = '.svg, .json, .csv, .md, .txt';

export const SV_FORMATS_HINT = 'SVG shapes, zoom, and source. Education/research only.';

export const SV_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const SV_RELATED_TOOLS: ReadonlyArray<SvRelatedToolLink> = [
  { label: 'PSD Viewer', description: 'Photoshop layers', path: '/file-viewers/psd-viewer' },
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' },
  { label: 'AI File Viewer', description: 'Illustrator preview', path: '/file-viewers/ai-file-viewer' },
  { label: 'PDF Viewer', description: 'Read PDF documents', path: '/file-viewers/pdf-viewer' }
];
