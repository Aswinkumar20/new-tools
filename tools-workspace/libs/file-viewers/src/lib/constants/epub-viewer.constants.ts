import type { EpRelatedToolLink } from '../types/epub-viewer.types';

export const EP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.epub', '.txt', '.json', '.csv', '.md'];

export const EP_ACCEPT_ATTR =
  '.epub,.txt,.json,.csv,.md,application/epub+zip,application/zip,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const EP_FORMATS_LABEL = '.epub, .json, .csv, .md, .txt';

export const EP_FORMATS_HINT = 'EPUB chapters, TOC, and typography. Education/research only.';

export const EP_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const EP_RELATED_TOOLS: ReadonlyArray<EpRelatedToolLink> = [
  { label: 'MOBI Viewer', description: 'Kindle-format preview', path: '/file-viewers/mobi-viewer' },
  { label: 'PDF Viewer', description: 'Read PDF documents', path: '/file-viewers/pdf-viewer' },
  { label: 'Markdown Previewer', description: 'Markdown typography', path: '/file-viewers/markdown-previewer' },
  { label: 'Text File Viewer', description: 'Plain-text source', path: '/file-viewers/text-file-viewer' }
];
