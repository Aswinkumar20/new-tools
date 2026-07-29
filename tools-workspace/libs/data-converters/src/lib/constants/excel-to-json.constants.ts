import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type {
  ExcelColumnMapping,
  ExcelColumnType,
  ExcelHeaderStrategy,
  ExcelOutputFormat,
  ExcelSheetPreviewRow
} from '../types/excel-to-json.types';

export const EXCEL_TO_JSON_SHEETJS_URL =
  'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';

export const EXCEL_TO_JSON_HISTORY_LIMIT = 6;

export const EXCEL_TO_JSON_VALID_EXTENSIONS = [
  '.xlsx',
  '.xls',
  '.xlsm',
  '.xlsb',
  '.csv',
  '.ods',
  '.fods'
] as const;

export const EXCEL_TO_JSON_ACCEPT =
  '.xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.fods';

export const EXCEL_TO_JSON_HERO_HIGHLIGHTS = [
  {
    title: 'Multi-sheet support',
    detail: 'Upload workbooks and choose which worksheet to convert.'
  },
  {
    title: 'Flexible headers',
    detail: 'Use the first row, auto-detect headers, or define custom key names.'
  },
  {
    title: 'Clean output',
    detail: 'Format dates, coerce types, filter columns, and export JSON or CSV.'
  }
] as const;

export const EXCEL_TO_JSON_OUTPUT_FORMATS: ReadonlyArray<{
  value: ExcelOutputFormat;
  label: string;
}> = [
  { value: 'json-array', label: 'Array of objects (JSON)' },
  { value: 'json-object', label: 'Keyed object (JSON)' },
  { value: 'csv', label: 'CSV' }
];

export const EXCEL_TO_JSON_HEADER_STRATEGIES: ReadonlyArray<{
  value: ExcelHeaderStrategy;
  label: string;
}> = [
  { value: 'auto', label: 'Auto-detect headers' },
  { value: 'first-row', label: 'Use first row as headers' },
  { value: 'custom', label: 'Define custom headers' }
];

export const EXCEL_TO_JSON_COLUMN_TYPES: ReadonlyArray<{
  value: ExcelColumnType;
  label: string;
}> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' }
];

export const EXCEL_TO_JSON_SAMPLE_SHEET = 'Cities';

export const EXCEL_TO_JSON_SAMPLE_PREVIEW: ExcelSheetPreviewRow[] = [
  { City: 'Tokyo', Country: 'Japan', Population: '37,435,191', Updated: '2025-01-01' },
  { City: 'Delhi', Country: 'India', Population: '29,399,141', Updated: '2025-01-02' },
  { City: 'São Paulo', Country: 'Brazil', Population: '21,846,507', Updated: '2025-01-03' }
];

export const EXCEL_TO_JSON_SAMPLE_MAPPINGS: ExcelColumnMapping[] = [
  { columnName: 'City', keyName: 'city', type: 'string' },
  { columnName: 'Country', keyName: 'country', type: 'string' },
  { columnName: 'Population', keyName: 'population', type: 'number' },
  { columnName: 'Updated', keyName: 'updated', type: 'date' }
];

export const EXCEL_TO_JSON_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Convert CSV text without a spreadsheet file'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate exported JSON'
  },
  {
    label: 'HTML Table to JSON',
    path: '/data-converters/html-table-to-json',
    description: 'Extract JSON from HTML tables'
  },
  {
    label: 'HTML Table Exporter',
    path: '/code-file-tools/html-table-exporter',
    description: 'Export HTML tables to CSV or JSON'
  },
  {
    label: 'Tables to PDF',
    path: '/pdf-tools/tables-to-pdf',
    description: 'Render tabular data as a PDF'
  }
];
