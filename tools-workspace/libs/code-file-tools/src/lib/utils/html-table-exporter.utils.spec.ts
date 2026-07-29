import {
  HTML_TABLE_SAMPLE
} from '../constants/html-table-exporter.constants';
import {
  buildTableExportResult,
  exportTableToCsv,
  exportTableToJson,
  looksLikeCsvSource,
  parseHtmlTable,
  resolveHtmlTableExporterSuggestion
} from './html-table-exporter.utils';

describe('html-table-exporter.utils', () => {
  it('parses the sample HTML table', () => {
    const outcome = parseHtmlTable(HTML_TABLE_SAMPLE);
    expect(outcome.error).toBeNull();
    expect(outcome.data?.headers).toEqual(['ID', 'Name', 'Email', 'Status']);
    expect(outcome.data?.rows.length).toBe(3);
    expect(outcome.data?.rows[0][1]).toBe('John Doe');
  });

  it('returns an error when no table is present', () => {
    const outcome = parseHtmlTable('<div>no table</div>');
    expect(outcome.data).toBeNull();
    expect(outcome.error).toContain('No table found');
  });

  it('exports CSV and JSON with headers', () => {
    const data = parseHtmlTable(HTML_TABLE_SAMPLE).data!;
    const csv = exportTableToCsv(data, true);
    expect(csv.split('\n')[0]).toBe('ID,Name,Email,Status');
    expect(csv).toContain('john@example.com');

    const json = JSON.parse(exportTableToJson(data, true));
    expect(json[0].Name).toBe('John Doe');
  });

  it('exports JSON as arrays when headers are excluded', () => {
    const data = parseHtmlTable(HTML_TABLE_SAMPLE).data!;
    const parsed = JSON.parse(exportTableToJson(data, false));
    expect(parsed[0]).toEqual(['ID', 'Name', 'Email', 'Status']);
    expect(parsed.length).toBe(4);
  });

  it('builds export metadata for each format', () => {
    const data = parseHtmlTable(HTML_TABLE_SAMPLE).data!;
    const csv = buildTableExportResult(data, 'csv', true);
    expect(csv.filename).toBe('table.csv');
    expect(csv.mimeType).toBe('text/csv');

    const md = buildTableExportResult(data, 'markdown', true);
    expect(md.filename).toBe('table.md');
    expect(md.content).toContain('| ID |');
  });

  it('detects CSV-like input and resolves suggestions', () => {
    expect(looksLikeCsvSource('a,b\n1,2')).toBe(true);
    expect(looksLikeCsvSource(HTML_TABLE_SAMPLE)).toBe(false);

    expect(resolveHtmlTableExporterSuggestion('', 'csv', false, null)?.path).toBe(
      '/data-converters/csv-to-json-json-to-csv'
    );
    expect(
      resolveHtmlTableExporterSuggestion('a,b\n1,2', 'csv', false, null)?.id
    ).toBe('csv-input');
    expect(
      resolveHtmlTableExporterSuggestion(HTML_TABLE_SAMPLE, 'csv', true, null)?.path
    ).toBe('/data-converters/csv-to-json-json-to-csv');
    expect(
      resolveHtmlTableExporterSuggestion(HTML_TABLE_SAMPLE, 'json', true, null)?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');
  });
});
