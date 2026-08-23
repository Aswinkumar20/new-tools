import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  EXCEL_MAX_ZOOM,
  EXCEL_MIN_ZOOM,
  EXCEL_SUPPORTED_EXTENSIONS,
  EXCEL_ZOOM_STEP
} from '../constants/excel-viewer.constants';
import type {
  ExcelCellView,
  ExcelSearchHit,
  ExcelSheetRenderResult,
  XLSX,
  XLSXCell,
  XLSXWorksheet
} from '../types/excel-viewer.types';

export function getExcelFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function isSupportedExcelFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = EXCEL_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getExcelFileExtension(file.name);
  return (
    extensions.includes(ext) ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')
  );
}

export function filterValidExcelFiles(files: ReadonlyArray<File>): File[] {
  return files.filter((file) => isSupportedExcelFile(file));
}

export function formatExcelFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getExcelColumnLetter(col: number): string {
  let result = '';
  let remaining = col;
  while (remaining >= 0) {
    result = String.fromCodePoint(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return result;
}

export function clampExcelZoom(level: number): number {
  return Math.max(EXCEL_MIN_ZOOM, Math.min(EXCEL_MAX_ZOOM, level));
}

export function stepExcelZoom(current: number, direction: 1 | -1): number {
  return clampExcelZoom(current + direction * EXCEL_ZOOM_STEP);
}

export function formatExcelCellDisplay(cell: XLSXCell): string {
  if (cell.v === undefined || cell.v === null) {
    return '';
  }
  if (cell.t === 'd') {
    return new Date(cell.v as string | number | Date).toLocaleString();
  }
  return cell.w || String(cell.v);
}

export function buildExcelSheetView(
  xlsx: XLSX,
  worksheet: XLSXWorksheet
): ExcelSheetRenderResult {
  const range = worksheet['!ref'];
  if (!range) {
    return { sheetData: [], sheetHeaders: [], maxRows: 0, maxCols: 0 };
  }

  const decodedRange = xlsx.utils.decode_range(range);
  const sheetData: ExcelCellView[][] = [];

  for (let row = 0; row <= decodedRange.e.r; row++) {
    const rowData: ExcelCellView[] = [];
    for (let col = 0; col <= decodedRange.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress] as XLSXCell | undefined;

      if (cell) {
        rowData.push({
          value: cell.v,
          displayValue: formatExcelCellDisplay(cell),
          formula: cell.f,
          style: cell.s
        });
      } else {
        rowData.push({ value: '', displayValue: '', formula: undefined, style: undefined });
      }
    }
    sheetData.push(rowData);
  }

  const sheetHeaders: string[] = [];
  for (let col = 0; col <= decodedRange.e.c; col++) {
    sheetHeaders.push(getExcelColumnLetter(col));
  }

  return {
    sheetData,
    sheetHeaders,
    maxRows: decodedRange.e.r + 1,
    maxCols: decodedRange.e.c + 1
  };
}

export function findExcelSearchHits(
  sheetData: ReadonlyArray<ReadonlyArray<ExcelCellView>>,
  searchText: string
): ExcelSearchHit[] {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const hits: ExcelSearchHit[] = [];
  for (let row = 0; row < sheetData.length; row++) {
    for (let col = 0; col < sheetData[row].length; col++) {
      const cellValue = (sheetData[row][col]?.displayValue || '').toLowerCase();
      if (cellValue.includes(query)) {
        hits.push({ row, col });
      }
    }
  }
  return hits;
}

export function escapeExcelHtml(text: string): string {
  if (typeof document === 'undefined') {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function buildExcelPrintTableHtml(
  sheetHeaders: ReadonlyArray<string>,
  sheetData: ReadonlyArray<ReadonlyArray<ExcelCellView>>
): string {
  let html = '<table><thead><tr><th>#</th>';
  for (const header of sheetHeaders) {
    html += `<th>${escapeExcelHtml(header)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let row = 0; row < sheetData.length; row++) {
    html += `<tr><td><strong>${row + 1}</strong></td>`;
    for (let col = 0; col < sheetData[row].length; col++) {
      const value = sheetData[row][col]?.displayValue || '';
      html += `<td>${escapeExcelHtml(value)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

export function isFullscreenActive(doc: Document = document): boolean {
  const extended = doc as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    doc.fullscreenElement ||
    extended.webkitFullscreenElement ||
    extended.mozFullScreenElement ||
    extended.msFullscreenElement
  );
}

export async function loadSheetJSLibrary(): Promise<XLSX> {
  if (globalThis.window === undefined) {
    throw new TypeError('SheetJS can only be loaded in browser environment');
  }

  const xlsxMod = await import('xlsx');
  const lib = (xlsxMod.default ?? xlsxMod) as unknown as XLSX;
  if (!lib?.read) {
    throw new Error('Failed to load SheetJS library');
  }
  return lib;
}

export function resolveExcelSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  currentFileName: string;
  sheetCount: number;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, currentFileName, sheetCount } = options;
  const ext = getExcelFileExtension(currentFileName).toLowerCase();

  if (hasError) {
    return {
      id: 'ev-meta',
      title: 'Check the file type?',
      reason:
        'Parsing failed or the format was rejected. Confirm MIME type and extension before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'ev-convert',
      title: 'Need JSON instead of a preview?',
      reason:
        'When you want machine-readable rows for APIs or scripts, convert the workbook with Excel to JSON.',
      actionLabel: 'Open Excel to JSON',
      path: '/data-converters/excel-to-json'
    };
  }

  if (ext === '.csv') {
    return {
      id: 'ev-csv',
      title: 'Working with CSV data?',
      reason: 'CSV files convert cleanly to JSON for pipelines. Preview here, then convert when ready.',
      actionLabel: 'Open CSV ↔ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (sheetCount > 1) {
    return {
      id: 'ev-multi-sheet',
      title: 'Export sheets as JSON?',
      reason:
        'Multi-sheet workbooks often need per-sheet JSON. Convert after you confirm the right sheet here.',
      actionLabel: 'Open Excel to JSON',
      path: '/data-converters/excel-to-json'
    };
  }

  return {
    id: 'ev-json',
    title: 'Convert this workbook?',
    reason: 'Turn the current spreadsheet into structured JSON without leaving EasyToolHub.',
    actionLabel: 'Open Excel to JSON',
    path: '/data-converters/excel-to-json'
  };
}
