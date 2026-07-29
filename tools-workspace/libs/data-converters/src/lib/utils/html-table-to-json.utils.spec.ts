import { HTML_TABLE_TO_JSON_SAMPLE } from '../constants/html-table-to-json.constants';
import {
  convertHtmlTableToJson,
  extractHtmlTable,
  looksLikeCsvSource,
  parseHtmlTableNumber,
  resolveHtmlTableToJsonSuggestion
} from './html-table-to-json.utils';

describe('html-table-to-json.utils', () => {
  const defaultOptions = {
    headerRows: 1,
    trimCells: true,
    compactArrays: false,
    includeEmptyCells: true,
    dateDetection: false,
    numberDetection: true,
    selectionMode: 'auto' as const
  };

  it('extracts headers and rows from the sample table', () => {
    const extraction = extractHtmlTable(HTML_TABLE_TO_JSON_SAMPLE, defaultOptions);
    expect(extraction.headers).toEqual(['id', 'name', 'email', 'active']);
    // Auto mode walks table.rows, so the header row is also present in data rows.
    expect(extraction.rows.length).toBe(3);
    expect(extraction.rows[1][1]).toBe('Ada Lovelace');
  });

  it('converts sample HTML to JSON objects with number detection', () => {
    const outcome = convertHtmlTableToJson(
      HTML_TABLE_TO_JSON_SAMPLE,
      'auto',
      '',
      1,
      true,
      false,
      true,
      false,
      true
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const parsed = JSON.parse(outcome.output);
    expect(parsed[1].name).toBe('Ada Lovelace');
    expect(parsed[1].id).toBe(1);
    expect(outcome.metrics.rows).toBe(3);
  });

  it('rejects empty input and missing custom selectors', () => {
    expect(convertHtmlTableToJson('', 'auto', '', 1, true, false, true, false, true).ok).toBe(
      false
    );
    expect(
      convertHtmlTableToJson('<table></table>', 'custom', '', 1, true, false, true, false, true)
        .ok
    ).toBe(false);
  });

  it('parses numbers and detects CSV-like sources', () => {
    expect(parseHtmlTableNumber('1,234.5')).toBe(1234.5);
    expect(parseHtmlTableNumber('abc')).toBeNull();
    expect(looksLikeCsvSource('a,b\n1,2')).toBe(true);
    expect(looksLikeCsvSource(HTML_TABLE_TO_JSON_SAMPLE)).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveHtmlTableToJsonSuggestion('', false, 'idle')?.path).toBe(
      '/data-converters/csv-to-json-json-to-csv'
    );
    expect(
      resolveHtmlTableToJsonSuggestion(HTML_TABLE_TO_JSON_SAMPLE, true, 'success')?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');
  });
});
