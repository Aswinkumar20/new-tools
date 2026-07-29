import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { HtmlTableExportFormat } from '../types/html-table-exporter.types';

export const HTML_TABLE_DEFAULT_FORMAT: HtmlTableExportFormat = 'csv';

export const HTML_TABLE_SAMPLE = `<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>John Doe</td>
      <td>john@example.com</td>
      <td>Active</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Jane Smith</td>
      <td>jane@example.com</td>
      <td>Inactive</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Bob Johnson</td>
      <td>bob@example.com</td>
      <td>Active</td>
    </tr>
  </tbody>
</table>`;

export const HTML_TABLE_EXPORT_META: Readonly<
  Record<HtmlTableExportFormat, { filename: string; mimeType: string }>
> = {
  csv: { filename: 'table.csv', mimeType: 'text/csv' },
  tsv: { filename: 'table.tsv', mimeType: 'text/tab-separated-values' },
  json: { filename: 'table.json', mimeType: 'application/json' },
  xml: { filename: 'table.xml', mimeType: 'application/xml' },
  markdown: { filename: 'table.md', mimeType: 'text/markdown' }
};

export const HTML_TABLE_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'HTML Table to JSON',
    path: '/data-converters/html-table-to-json',
    description: 'Dedicated HTML table → JSON converter'
  },
  {
    label: 'CSV ↔ JSON',
    path: '/data-converters/csv-to-json-json-to-csv',
    description: 'Round-trip CSV and JSON datasets'
  },
  {
    label: 'Tables to PDF',
    path: '/pdf-tools/tables-to-pdf',
    description: 'Render tabular data as a PDF'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print exported JSON'
  },
  {
    label: 'HTML Minifier',
    path: '/code-file-tools/html-minifier',
    description: 'Minify source HTML before export'
  }
];
