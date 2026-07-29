export type ExcelCopyStatus = 'idle' | 'success' | 'error';
export type ExcelConversionState = 'idle' | 'success' | 'error';
export type ExcelOutputFormat = 'json-array' | 'json-object' | 'csv';
export type ExcelHeaderStrategy = 'auto' | 'first-row' | 'custom';
export type ExcelColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface ExcelHistoryEntry {
  label: string;
  timestamp: string;
}

export interface ExcelConversionStatus {
  status: ExcelConversionState;
  message: string;
}

export interface ExcelMetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
  fileName?: string;
}

export interface ExcelDiagnostic {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ExcelColumnMapping {
  columnName: string;
  keyName: string;
  type: ExcelColumnType;
}

export interface ExcelSheetPreviewRow {
  [key: string]: string | number | boolean | null;
}

export interface XlsxWorkbook {
  SheetNames: string[];
  Sheets: Record<string, XlsxWorksheet>;
}

export interface XlsxWorksheet {
  '!ref'?: string;
  [cell: string]: unknown;
}

export interface SheetJsModule {
  read(data: Uint8Array, options?: Record<string, unknown>): XlsxWorkbook;
  utils: {
    sheet_to_json<T>(worksheet: XlsxWorksheet, options?: Record<string, unknown>): T[];
    decode_range(range: string): { s: { r: number; c: number }; e: { r: number; c: number } };
  };
  write(workbook: XlsxWorkbook, options: Record<string, unknown>): string | ArrayBuffer;
}

export interface ExcelCastOptions {
  convertDates: boolean;
  convertNumbers: boolean;
  trimWhitespace: boolean;
}

export interface ExcelConvertSuccess {
  ok: true;
  output: string;
  message: string;
  rowCount: number;
}

export interface ExcelConvertFailure {
  ok: false;
  message: string;
  diagnosticMessage: string;
  diagnosticLevel: 'error' | 'warning';
}
