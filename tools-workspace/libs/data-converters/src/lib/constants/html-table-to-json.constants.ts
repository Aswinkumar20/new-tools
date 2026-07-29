import type { DcRelatedToolLink } from '../shared/dc-tool-suggestion.model';
import type { HtmlTableSelectionModeOption } from '../types/html-table-to-json.types';

export const HTML_TABLE_TO_JSON_HISTORY_LIMIT = 6;

export const HTML_TABLE_TO_JSON_SAMPLE = `<table>
  <thead>
    <tr>
      <th>id</th>
      <th>name</th>
      <th>email</th>
      <th>active</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Ada Lovelace</td>
      <td>ada@example.com</td>
      <td>true</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Alan Turing</td>
      <td>alan@example.com</td>
      <td>false</td>
    </tr>
  </tbody>
</table>`;

export const HTML_TABLE_TO_JSON_SELECTION_MODES: ReadonlyArray<HtmlTableSelectionModeOption> = [
  {
    id: 'auto',
    label: 'Auto detect',
    description: 'Look for the first <table> element, merging tHead/tBody/tFoot automatically.'
  },
  {
    id: 'body',
    label: 'Use table body',
    description: 'Ignore table headers; treat every row as data.'
  },
  {
    id: 'custom',
    label: 'Custom selector',
    description: 'Target a specific table or section with a CSS selector.'
  }
];

export const HTML_TABLE_TO_JSON_USAGE_STEPS = [
  'Paste HTML containing a table or upload an HTML file.',
  'Pick how rows/columns should be detected (auto, body, or a custom selector).',
  'Adjust header rows, trim options, and detection for numbers/dates.',
  'Convert and copy/download the JSON output for analytics or automation.'
] as const;

export const HTML_TABLE_TO_JSON_CALLOUTS = [
  {
    title: 'Smart detection',
    detail: 'Auto-detects table headers, footers, merged cells, and row spans when possible.'
  },
  {
    title: 'Custom control',
    detail: 'Use CSS selectors to isolate nested tables or specific table regions.'
  },
  {
    title: 'Ready to share',
    detail: 'Copy to clipboard or download formatted JSON for downstream scripts.'
  }
] as const;

export const HTML_TABLE_TO_JSON_RELATED_TOOLS: ReadonlyArray<DcRelatedToolLink> = [
  {
    label: 'HTML Table Exporter',
    path: '/code-file-tools/html-table-exporter',
    description: 'Export HTML tables to CSV, TSV, XML, or Markdown'
  },
  {
    label: 'CSV ⇄ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Round-trip converted data as CSV'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print and validate exported JSON'
  },
  {
    label: 'Excel to JSON',
    path: '/data-converters/excel-to-json',
    description: 'Convert spreadsheet workbooks instead of HTML'
  },
  {
    label: 'Tables to PDF',
    path: '/pdf-tools/tables-to-pdf',
    description: 'Render tabular data as a PDF'
  }
];
