import type { AiRelatedToolLink } from '../types/ai-file-viewer.types';

export const AI_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ai', '.txt', '.json', '.csv', '.md'];

export const AI_ACCEPT_ATTR =
  '.ai,.txt,.json,.csv,.md,application/postscript,application/pdf,application/illustrator,application/json,text/plain,text/csv,text/markdown';

export const AI_FORMATS_LABEL = '.ai, .json, .csv, .md, .txt';

export const AI_FORMATS_HINT = 'Illustrator artboards and preview. Education/research only.';

export const AI_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const AI_RELATED_TOOLS: ReadonlyArray<AiRelatedToolLink> = [
  { label: 'SVG Viewer', description: 'Vector zoom and source', path: '/file-viewers/svg-viewer' },
  { label: 'PSD Viewer', description: 'Photoshop layers', path: '/file-viewers/psd-viewer' },
  { label: 'PDF Viewer', description: 'Read PDF documents', path: '/file-viewers/pdf-viewer' },
  { label: 'Image Viewer', description: 'Raster image preview', path: '/file-viewers/image-viewer' }
];
