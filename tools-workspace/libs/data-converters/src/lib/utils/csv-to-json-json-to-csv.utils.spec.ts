import { SAMPLE_CSV, SAMPLE_JSON } from '../constants/csv-to-json-json-to-csv.constants';
import {
  convertCsvToJson,
  convertJsonToCsv,
  looksLikeHtmlTableSource,
  looksLikeYamlSource,
  parseCsv,
  resolveCsvJsonSuggestion
} from './csv-to-json-json-to-csv.utils';

describe('csv-to-json-json-to-csv.utils', () => {
  const parseOptions = {
    delimiter: ',',
    quote: '"',
    hasHeader: true,
    trim: true,
    skipEmpty: true,
    lineEnding: 'auto' as const
  };

  it('parses sample CSV with headers', () => {
    const parsed = parseCsv(SAMPLE_CSV, parseOptions);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) {
      return;
    }
    expect(parsed.headers).toEqual(['id', 'name', 'email', 'active', 'created_at']);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows[0][1]).toBe('Ada Lovelace');
  });

  it('converts CSV to pretty JSON objects', () => {
    const outcome = convertCsvToJson(SAMPLE_CSV, parseOptions, true, false);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const json = JSON.parse(outcome.output);
    expect(json[0].email).toBe('ada@example.com');
    expect(outcome.metrics.rows).toBe(3);
  });

  it('converts JSON array of objects to CSV', () => {
    const outcome = convertJsonToCsv(SAMPLE_JSON, 'auto', {
      delimiter: ',',
      quote: '"',
      includeHeader: true,
      sortKeys: false,
      trimWhitespace: true
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.output.split('\n')[0]).toContain('id');
    expect(outcome.output).toContain('Notebook');
    expect(outcome.metrics.rows).toBe(3);
  });

  it('rejects empty and invalid JSON for CSV conversion', () => {
    expect(convertJsonToCsv('', 'auto', {
      delimiter: ',',
      quote: '"',
      includeHeader: true,
      sortKeys: false,
      trimWhitespace: true
    }).ok).toBe(false);

    expect(convertJsonToCsv('{', 'auto', {
      delimiter: ',',
      quote: '"',
      includeHeader: true,
      sortKeys: false,
      trimWhitespace: true
    }).ok).toBe(false);
  });

  it('detects alternate formats and resolves suggestions', () => {
    expect(looksLikeHtmlTableSource('<table><tr><td>1</td></tr></table>')).toBe(true);
    expect(looksLikeYamlSource('name: Ada\nactive: true')).toBe(true);
    expect(looksLikeYamlSource(SAMPLE_CSV)).toBe(false);

    expect(resolveCsvJsonSuggestion('csv-to-json', '', 'idle', false)?.path).toBe(
      '/data-converters/excel-to-json'
    );
    expect(
      resolveCsvJsonSuggestion('csv-to-json', SAMPLE_CSV, 'success', true)?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');
  });
});
