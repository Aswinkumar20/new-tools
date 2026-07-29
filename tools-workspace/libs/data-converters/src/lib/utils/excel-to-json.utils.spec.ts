import {
  castExcelValue,
  convertExcelRowsToCsv,
  convertExcelRowsToKeyedObject,
  escapeExcelCsvValue,
  formatExcelBytes,
  getExcelCellAddress,
  isSupportedExcelFile,
  resolveExcelToJsonSuggestion
} from './excel-to-json.utils';

describe('excel-to-json.utils', () => {
  it('formats bytes and cell addresses', () => {
    expect(formatExcelBytes(0)).toBe('0 B');
    expect(formatExcelBytes(2048)).toBe('2.00 KB');
    expect(getExcelCellAddress(0, 0)).toBe('A1');
    expect(getExcelCellAddress(1, 26)).toBe('AA2');
  });

  it('validates supported Excel file types', () => {
    expect(isSupportedExcelFile(new File([''], 'data.xlsx'))).toBe(true);
    expect(isSupportedExcelFile(new File([''], 'data.csv'))).toBe(true);
    expect(isSupportedExcelFile(new File([''], 'notes.txt'))).toBe(false);
  });

  it('casts values according to column type options', () => {
    const options = { convertDates: true, convertNumbers: true, trimWhitespace: true };
    expect(castExcelValue('42', 'number', options)).toBe(42);
    expect(castExcelValue('yes', 'boolean', options)).toBe(true);
    expect(castExcelValue('2025-01-01', 'date', options)).toContain('2025-01-01');
    expect(castExcelValue('  hi  ', 'string', options)).toBe('  hi  ');
  });

  it('escapes and builds CSV rows', () => {
    expect(escapeExcelCsvValue('a,b')).toBe('"a,b"');
    const csv = convertExcelRowsToCsv(
      [{ city: 'Tokyo', country: 'Japan' }],
      [
        { columnName: 'City', keyName: 'city', type: 'string' },
        { columnName: 'Country', keyName: 'country', type: 'string' }
      ]
    );
    expect(csv).toBe('city,country\nTokyo,Japan');
  });

  it('builds keyed JSON objects', () => {
    const json = convertExcelRowsToKeyedObject(
      [{ city: 'Tokyo', country: 'Japan' }],
      [
        { columnName: 'City', keyName: 'city', type: 'string' },
        { columnName: 'Country', keyName: 'country', type: 'string' }
      ],
      'city'
    );
    expect(JSON.parse(json).Tokyo.country).toBe('Japan');
  });

  it('resolves contextual suggestions', () => {
    expect(resolveExcelToJsonSuggestion(false, false, 'json-array', '', 'idle')?.path).toBe(
      '/data-converters/csv-to-json-json-to-csv'
    );
    expect(
      resolveExcelToJsonSuggestion(true, true, 'json-array', 'book.xlsx', 'success')?.path
    ).toBe('/data-converters/json-formatter-beautifier-validator');
    expect(resolveExcelToJsonSuggestion(true, true, 'csv', 'book.xlsx', 'success')?.path).toBe(
      '/data-converters/csv-to-json-json-to-csv'
    );
  });
});
