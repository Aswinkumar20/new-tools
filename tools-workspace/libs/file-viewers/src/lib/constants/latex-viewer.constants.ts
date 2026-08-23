import type { LxRelatedToolLink } from '../types/latex-viewer.types';

export const LX_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.tex', '.txt', '.json', '.csv', '.md'];

export const LX_ACCEPT_ATTR =
  '.tex,.txt,.json,.csv,.md,application/x-tex,application/x-latex,text/x-tex,application/json,text/plain,text/csv,text/markdown';

export const LX_FORMATS_LABEL = '.tex, .json, .csv, .md, .txt';

export const LX_FORMATS_HINT = 'LaTeX structure and preview. Education/research only.';

export const LX_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const LX_RELATED_TOOLS: ReadonlyArray<LxRelatedToolLink> = [
  { label: 'Markdown Previewer', description: 'Markdown typography', path: '/file-viewers/markdown-previewer' },
  { label: 'PDF Viewer', description: 'Read PDF documents', path: '/file-viewers/pdf-viewer' },
  { label: 'Text File Viewer', description: 'Plain-text source', path: '/file-viewers/text-file-viewer' },
  { label: 'EPUB Viewer', description: 'Ebook chapters', path: '/file-viewers/epub-viewer' }
];
