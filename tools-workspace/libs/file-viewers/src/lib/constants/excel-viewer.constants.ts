import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const EXCEL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.xlsx',
  '.xls',
  '.xlsm',
  '.xlsb',
  '.csv',
  '.ods',
  '.fods',
  '.numbers'
];

export const EXCEL_ACCEPT_ATTR = EXCEL_SUPPORTED_EXTENSIONS.join(',');

export const EXCEL_DEFAULT_ZOOM = 100;
export const EXCEL_MIN_ZOOM = 50;
export const EXCEL_MAX_ZOOM = 200;
export const EXCEL_ZOOM_STEP = 10;
export const EXCEL_ZOOM_APPLY_DELAY_MS = 100;
export const EXCEL_SEARCH_HIGHLIGHT_MS = 1000;
export const EXCEL_PRINT_DELAY_MS = 250;

export const EXCEL_DOWNLOAD_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const EXCEL_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Excel to JSON',
    path: '/data-converters/excel-to-json',
    description: 'Convert workbook sheets into structured JSON for APIs and scripts'
  },
  {
    label: 'CSV ↔ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Round-trip CSV exports when you need machine-readable rows'
  },
  {
    label: 'Word Viewer',
    path: '/file-viewers/word-viewer',
    description: 'Preview companion DOCX reports that ship with spreadsheets'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect MIME type and size for unusual spreadsheet containers'
  }
];
