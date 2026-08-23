import type { RtRelatedToolLink } from '../types/rtf-viewer.types';

export const RT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.rtf', '.txt', '.json', '.csv', '.md'];

export const RT_ACCEPT_ATTR =
  '.rtf,.txt,.json,.csv,.md,application/rtf,text/rtf,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const RT_FORMATS_LABEL = '.rtf, .json, .csv, .md, .txt';

export const RT_FORMATS_HINT = 'Rich Text formatting and export. Education/research only.';

export const RT_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const RT_RELATED_TOOLS: ReadonlyArray<RtRelatedToolLink> = [
  { label: 'Word Viewer', description: 'DOCX document preview', path: '/file-viewers/word-viewer' },
  { label: 'OpenDocument Viewer', description: 'ODT / ODS / ODP', path: '/file-viewers/opendocument-viewer' },
  { label: 'Text File Viewer', description: 'Plain-text source', path: '/file-viewers/text-file-viewer' },
  { label: 'Markdown Previewer', description: 'Markdown typography', path: '/file-viewers/markdown-previewer' }
];
