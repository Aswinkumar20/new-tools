import {
  buildExcelPrintTableHtml,
  clampExcelZoom,
  filterValidExcelFiles,
  findExcelSearchHits,
  formatExcelCellDisplay,
  formatExcelFileSize,
  getExcelColumnLetter,
  getExcelFileExtension,
  isSupportedExcelFile,
  resolveExcelSuggestion,
  stepExcelZoom
} from './excel-viewer.utils';
import type { ExcelCellView } from '../types/excel-viewer.types';

describe('excel-viewer.utils', () => {
  it('detects supported spreadsheet files', () => {
    expect(isSupportedExcelFile({ name: 'a.xlsx', type: '' })).toBe(true);
    expect(isSupportedExcelFile({ name: 'a.txt', type: 'application/vnd.ms-excel' })).toBe(true);
    expect(isSupportedExcelFile({ name: 'a.txt', type: 'text/plain' })).toBe(false);
    expect(filterValidExcelFiles([new File([''], 'a.csv'), new File([''], 'b.txt')])).toHaveLength(
      1
    );
  });

  it('formats sizes, columns, and zoom', () => {
    expect(formatExcelFileSize(0)).toBe('0 Bytes');
    expect(formatExcelFileSize(2048)).toContain('KB');
    expect(getExcelFileExtension('Book.XLSX')).toBe('.xlsx');
    expect(getExcelColumnLetter(0)).toBe('A');
    expect(getExcelColumnLetter(26)).toBe('AA');
    expect(clampExcelZoom(30)).toBe(50);
    expect(clampExcelZoom(250)).toBe(200);
    expect(stepExcelZoom(100, 1)).toBe(110);
    expect(stepExcelZoom(50, -1)).toBe(50);
  });

  it('formats cell display values', () => {
    expect(formatExcelCellDisplay({ v: 12, t: 'n', w: '12.00' })).toBe('12.00');
    expect(formatExcelCellDisplay({ v: 'hi', t: 's' })).toBe('hi');
    expect(formatExcelCellDisplay({})).toBe('');
  });

  it('finds search hits and builds print HTML', () => {
    const sheetData: ExcelCellView[][] = [
      [
        { value: 'Alpha', displayValue: 'Alpha' },
        { value: 'Beta', displayValue: 'Beta' }
      ],
      [
        { value: 'gamma', displayValue: 'gamma' },
        { value: '', displayValue: '' }
      ]
    ];

    expect(findExcelSearchHits(sheetData, 'a')).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 }
    ]);
    expect(findExcelSearchHits(sheetData, '   ')).toEqual([]);

    const html = buildExcelPrintTableHtml(['A', 'B'], sheetData);
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('Alpha');
    expect(html).toContain('<strong>2</strong>');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveExcelSuggestion({
        hasFiles: false,
        hasError: false,
        currentFileName: '',
        sheetCount: 0
      })?.id
    ).toBe('ev-convert');

    expect(
      resolveExcelSuggestion({
        hasFiles: true,
        hasError: true,
        currentFileName: 'a.xlsx',
        sheetCount: 1
      })?.id
    ).toBe('ev-meta');

    expect(
      resolveExcelSuggestion({
        hasFiles: true,
        hasError: false,
        currentFileName: 'export.csv',
        sheetCount: 1
      })?.id
    ).toBe('ev-csv');

    expect(
      resolveExcelSuggestion({
        hasFiles: true,
        hasError: false,
        currentFileName: 'book.xlsx',
        sheetCount: 3
      })?.id
    ).toBe('ev-multi-sheet');
  });
});
