import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import { EXCEL_TO_JSON_VALID_EXTENSIONS } from '../constants/excel-to-json.constants';
import type {
  ExcelCastOptions,
  ExcelColumnMapping,
  ExcelColumnType,
  ExcelConvertFailure,
  ExcelConvertSuccess,
  ExcelDiagnostic,
  ExcelHeaderStrategy,
  ExcelHistoryEntry,
  ExcelOutputFormat,
  ExcelSheetPreviewRow,
  SheetJsModule,
  XlsxWorksheet
} from '../types/excel-to-json.types';

export function formatExcelBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function createExcelDiagnosticId(now = Date.now()): string {
  return `diag-${now}-${Math.floor(Math.random() * 100000)}`;
}

export function createExcelDiagnostic(
  level: ExcelDiagnostic['level'],
  message: string
): ExcelDiagnostic {
  return {
    id: createExcelDiagnosticId(),
    level,
    message
  };
}

export function prependExcelHistory(
  entries: ExcelHistoryEntry[],
  label: string,
  limit: number,
  now = new Date()
): ExcelHistoryEntry[] {
  const timestamp = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return [{ label, timestamp }, ...entries].slice(0, limit);
}

export function blurActiveElement(): void {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function isSupportedExcelFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const isValidExtension = EXCEL_TO_JSON_VALID_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  );
  return (
    isValidExtension ||
    file.type.includes('sheet') ||
    file.type.includes('excel') ||
    file.type.includes('csv')
  );
}

export function getExcelCellAddress(row: number, column: number): string {
  const letters: string[] = [];
  let temp = column;
  do {
    letters.unshift(String.fromCharCode(65 + (temp % 26)));
    temp = Math.floor(temp / 26) - 1;
  } while (temp >= 0);
  return `${letters.join('')}${row + 1}`;
}

export function resolveExcelHeaders(
  worksheet: XlsxWorksheet,
  sheetjs: SheetJsModule,
  headerStrategy: ExcelHeaderStrategy,
  customHeadersInput: string
): string[] {
  const range = worksheet['!ref']
    ? sheetjs.utils.decode_range(worksheet['!ref'])
    : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  const headers: string[] = [];

  if (headerStrategy === 'auto' || headerStrategy === 'first-row') {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cellAddress = getExcelCellAddress(range.s.r, c);
      const cell = worksheet[cellAddress] as { v?: unknown } | undefined;
      let header = cell && cell.v ? String(cell.v).trim() : '';
      if (!header) {
        header = `column_${c - range.s.c + 1}`;
      }
      headers.push(header);
    }
    return headers;
  }

  if (headerStrategy === 'custom') {
    const trimmed = customHeadersInput
      .split(',')
      .map((header) => header.trim())
      .filter((header) => header.length > 0);
    return trimmed.length ? trimmed : headers;
  }

  return headers;
}

export function normalizeExcelPreviewRow(row: Record<string, unknown>): ExcelSheetPreviewRow {
  const preview: ExcelSheetPreviewRow = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      preview[key] = '';
      return;
    }
    if (typeof value === 'string') {
      preview[key] = value;
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      preview[key] = value;
      return;
    }
    preview[key] = JSON.stringify(value);
  });
  return preview;
}

export function castExcelValue(
  value: unknown,
  type: ExcelColumnType,
  options: ExcelCastOptions
): unknown {
  if (type === 'string') {
    return value === undefined || value === null ? '' : String(value);
  }
  if (type === 'number') {
    if (!options.convertNumbers) {
      return value;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', '1'].includes(normalized)) {
        return true;
      }
      if (['false', 'no', '0'].includes(normalized)) {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return value;
  }
  if (type === 'date') {
    if (!options.convertDates) {
      return value;
    }
    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toISOString();
  }
  return value;
}

export function extractExcelRows(
  sheet: XlsxWorksheet,
  sheetjs: SheetJsModule,
  headers: string[],
  mappings: ExcelColumnMapping[],
  headerStrategy: ExcelHeaderStrategy,
  includeEmptyRows: boolean,
  castOptions: ExcelCastOptions
): Array<Record<string, unknown>> {
  const headerRow = headerStrategy === 'first-row' ? 1 : 0;
  const rows = sheetjs.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: headers,
    range: headerRow,
    raw: false,
    defval: ''
  });

  const processedRows: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const processed: Record<string, unknown> = {};
    for (const mapping of mappings) {
      const rawValue = row[mapping.columnName];
      const coercedValue = castExcelValue(rawValue, mapping.type, castOptions);
      const finalValue =
        typeof coercedValue === 'string' && castOptions.trimWhitespace
          ? coercedValue.trim()
          : coercedValue;
      processed[mapping.keyName || mapping.columnName] = finalValue;
    }

    if (!includeEmptyRows) {
      const hasValue = Object.values(processed).some(
        (value) => value !== '' && value !== null && value !== undefined
      );
      if (!hasValue) {
        continue;
      }
    }

    processedRows.push(processed);
  }

  return processedRows;
}

export function escapeExcelCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function convertExcelRowsToCsv(
  rows: Array<Record<string, unknown>>,
  mappings: ExcelColumnMapping[]
): string {
  if (!rows.length) {
    return '';
  }
  const headers = mappings.map((mapping) => mapping.keyName || mapping.columnName);
  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((header) => escapeExcelCsvValue(row[header]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export function convertExcelRowsToKeyedObject(
  rows: Array<Record<string, unknown>>,
  mappings: ExcelColumnMapping[],
  keyColumn: string
): string {
  const key =
    keyColumn && mappings.some((mapping) => mapping.keyName === keyColumn)
      ? keyColumn
      : mappings[0]?.keyName;

  if (!key) {
    throw new Error('Select a column to use as the object key when using keyed JSON.');
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const keyValue = row[key];
    if (typeof keyValue !== 'string' && typeof keyValue !== 'number') {
      throw new Error(`Key column "${key}" must contain string or number values.`);
    }
    result[String(keyValue)] = row;
  }

  return JSON.stringify(result, null, 2);
}

export function buildExcelConversionOutput(
  rows: Array<Record<string, unknown>>,
  mappings: ExcelColumnMapping[],
  outputFormat: ExcelOutputFormat,
  keyColumn: string
): ExcelConvertSuccess | ExcelConvertFailure {
  if (!rows.length) {
    return {
      ok: false,
      message:
        'No rows to convert. The selected worksheet appears to be empty or all rows were filtered out.',
      diagnosticMessage:
        'No data rows found after applying filters. Try adjusting "Include blank rows" or check if the worksheet has data.',
      diagnosticLevel: 'warning'
    };
  }

  try {
    let output = '';
    if (outputFormat === 'csv') {
      output = convertExcelRowsToCsv(rows, mappings);
    } else if (outputFormat === 'json-object') {
      output = convertExcelRowsToKeyedObject(rows, mappings, keyColumn);
    } else {
      output = JSON.stringify(rows, null, 2);
    }

    if (!output || !output.trim()) {
      throw new Error(
        'Conversion produced empty output. Please check your data and column mappings.'
      );
    }

    return {
      ok: true,
      output,
      rowCount: rows.length,
      message: `Conversion successful: ${rows.length} rows exported to ${outputFormat.toUpperCase()}.`
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Conversion failed due to an unknown error.';
    return {
      ok: false,
      message: `Conversion Error: ${errorMessage}. Please check your settings and try again.`,
      diagnosticMessage: errorMessage,
      diagnosticLevel: 'error'
    };
  }
}

export async function loadSheetJsLibrary(
  existing: SheetJsModule | null,
  isBrowser: boolean
): Promise<SheetJsModule> {
  if (existing) {
    return existing;
  }

  if (!isBrowser) {
    throw new Error('Excel parsing is only available in a browser environment.');
  }

  const xlsxMod = await import('xlsx');
  const loaded = (xlsxMod.default ?? xlsxMod) as unknown as SheetJsModule;
  if (!loaded?.read) {
    throw new Error('Unable to load Excel parsing library.');
  }
  return loaded;
}

export function looksLikeCsvTextFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.csv');
}

export function resolveExcelToJsonSuggestion(
  hasWorksheet: boolean,
  hasResult: boolean,
  outputFormat: ExcelOutputFormat,
  fileName: string,
  status: 'idle' | 'success' | 'error'
): DcToolSuggestion | null {
  if (!hasWorksheet) {
    return {
      id: 'empty-workbook',
      title: 'Upload a spreadsheet to convert',
      reason:
        'Drop an Excel workbook here. For plain CSV text already on the clipboard, use CSV ⇄ JSON instead.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeCsvTextFile(fileName) && !hasResult) {
    return {
      id: 'csv-file',
      title: 'CSV file loaded',
      reason:
        'SheetJS can parse CSV files here. For delimiter/header tweaks on raw CSV text, CSV ⇄ JSON is often faster.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (hasResult && status === 'success' && outputFormat !== 'csv') {
    return {
      id: 'json-ready',
      title: 'JSON export ready',
      reason:
        'Pretty-print, lint, or validate the converted JSON before sending it to an API.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasResult && status === 'success' && outputFormat === 'csv') {
    return {
      id: 'csv-ready',
      title: 'CSV export ready',
      reason:
        'Round-trip this CSV with CSV ⇄ JSON, or open Tables to PDF for a printable report.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  return {
    id: 'configure-convert',
    title: 'Configure columns, then convert',
    reason:
      'Pick a sheet, map column types, and convert. After export, JSON Formatter helps polish the payload.',
    actionLabel: 'Open JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator'
  };
}
