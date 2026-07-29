import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type {
  CsvJsonModeOption,
  CsvLineEnding
} from '../types/csv-to-json-json-to-csv.types';

export const CSV_JSON_HISTORY_LIMIT = 6;

export const CSV_JSON_DELIMITER_OPTIONS = [',', ';', '\t', '|'] as const;

export const CSV_JSON_LINE_ENDING_OPTIONS: ReadonlyArray<{ id: CsvLineEnding; label: string }> = [
  { id: 'auto', label: 'Auto detect' },
  { id: 'lf', label: 'LF (\\n)' },
  { id: 'crlf', label: 'CRLF (\\r\\n)' }
];

export const CSV_JSON_MODES: ReadonlyArray<CsvJsonModeOption> = [
  {
    id: 'csv-to-json',
    label: 'CSV → JSON',
    description: 'Import tabular data and create clean, structured JSON output.'
  },
  {
    id: 'json-to-csv',
    label: 'JSON → CSV',
    description: 'Export arrays of objects into spreadsheets with custom delimiters.'
  }
];

export const CSV_JSON_USAGE_STEPS = [
  'Pick the direction you need: CSV → JSON or JSON → CSV.',
  'Paste or upload your data; configure delimiters, headers, and line endings.',
  'Run the conversion, then copy or download the result instantly.',
  'Use the history log to undo mistakes or repeat recent conversions.'
] as const;

export const CSV_JSON_CALLOUTS = [
  { title: 'Flexible Delimiters', detail: 'Commas, semicolons, pipes, or tabs—switch instantly.' },
  { title: 'Header Aware', detail: 'Choose whether CSV rows include headers and detect them safely.' },
  { title: 'Shareable Output', detail: 'Copy straight to clipboard or download formatted files.' }
] as const;

export const SAMPLE_CSV = `id,name,email,active,created_at
1,Ada Lovelace,ada@example.com,true,1843-12-10
2,Alan Turing,alan@example.com,true,1950-06-07
3,Grace Hopper,grace@example.com,false,1969-03-05`;

export const SAMPLE_JSON = `[
  {
    "id": 101,
    "product": "Notebook",
    "price": 12.5,
    "inStock": true
  },
  {
    "id": 102,
    "product": "Pen",
    "price": 2.25,
    "inStock": true
  },
  {
    "id": 103,
    "product": "Ruler",
    "price": 4.15,
    "inStock": false
  }
]`;

export const CSV_JSON_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate converted JSON'
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
    label: 'Excel to JSON',
    path: '/data-converters/excel-to-json',
    description: 'Convert spreadsheet files to JSON'
  },
  {
    label: 'YAML ⇄ JSON',
    path: '/data-converters/yaml-to-json-json-to-yaml',
    description: 'Round-trip YAML configuration with JSON'
  }
];
