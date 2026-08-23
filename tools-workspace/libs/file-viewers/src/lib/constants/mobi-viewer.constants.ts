import type { MbRelatedToolLink } from '../types/mobi-viewer.types';

export const MB_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.mobi', '.azw', '.txt', '.json', '.csv', '.md'];

export const MB_ACCEPT_ATTR =
  '.mobi,.azw,.txt,.json,.csv,.md,application/x-mobipocket-ebook,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const MB_FORMATS_LABEL = '.mobi, .azw, .json, .csv, .md, .txt';

export const MB_FORMATS_HINT = 'MOBI/AZW chapters and TOC. Education/research only.';

export const MB_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const MB_RELATED_TOOLS: ReadonlyArray<MbRelatedToolLink> = [
  { label: 'EPUB Viewer', description: 'EPUB chapters and TOC', path: '/file-viewers/epub-viewer' },
  { label: 'PDF Viewer', description: 'Read PDF documents', path: '/file-viewers/pdf-viewer' },
  { label: 'Markdown Previewer', description: 'Markdown typography', path: '/file-viewers/markdown-previewer' },
  { label: 'Text File Viewer', description: 'Plain-text source', path: '/file-viewers/text-file-viewer' }
];
