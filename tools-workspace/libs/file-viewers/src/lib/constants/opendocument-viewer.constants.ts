import type { OdRelatedToolLink } from '../types/opendocument-viewer.types';

export const OD_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.odt', '.ods', '.odp', '.txt', '.json', '.csv', '.md'];

export const OD_ACCEPT_ATTR =
  '.odt,.ods,.odp,.txt,.json,.csv,.md,application/vnd.oasis.opendocument.text,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.presentation,application/octet-stream,application/json,text/plain,text/csv,text/markdown';

export const OD_FORMATS_LABEL = '.odt, .ods, .odp, .json, .csv, .md, .txt';

export const OD_FORMATS_HINT = 'OpenDocument pages and sheets. Education/research only.';

export const OD_MAX_FILE_BYTES = 64 * 1024 * 1024;

export const OD_RELATED_TOOLS: ReadonlyArray<OdRelatedToolLink> = [
  { label: 'Word Viewer', description: 'DOCX document preview', path: '/file-viewers/word-viewer' },
  { label: 'Excel Viewer', description: 'Spreadsheet preview', path: '/file-viewers/excel-viewer' },
  { label: 'PowerPoint Viewer', description: 'Slide preview', path: '/file-viewers/powerpoint-viewer' },
  { label: 'RTF Viewer', description: 'Rich Text formatting', path: '/file-viewers/rtf-viewer' }
];
