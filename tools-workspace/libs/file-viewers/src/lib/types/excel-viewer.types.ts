export interface XLSX {
  read(data: ArrayBuffer | Uint8Array | string, options?: { type: string; cellDates?: boolean }): XLSXWorkbook;
  write(workbook: XLSXWorkbook, options?: { type: string; bookType?: string }): ArrayBuffer | Uint8Array | string;
  utils: {
    sheet_to_json(
      worksheet: XLSXWorksheet,
      options?: { header?: number | string[]; raw?: boolean; defval?: unknown }
    ): unknown[];
    json_to_sheet(data: unknown[]): XLSXWorksheet;
    sheet_to_html(worksheet: XLSXWorksheet, options?: { editable?: boolean; id?: string }): string;
    encode_range(range: XLSXRange): string;
    decode_range(range: string): XLSXRange;
    encode_cell(cell: { r: number; c: number }): string;
    format_cell(cell: XLSXCell, v?: unknown, opts?: unknown): string;
  };
}

export interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: { [key: string]: XLSXWorksheet };
}

export interface XLSXWorksheet {
  '!ref'?: string;
  '!cols'?: Array<{ wch?: number; width?: number }>;
  '!rows'?: Array<{ hpt?: number; hpx?: number }>;
  [cell: string]: unknown;
}

export interface XLSXCell {
  v?: unknown;
  t?: string;
  f?: string;
  z?: string;
  w?: string;
  s?: unknown;
}

export interface XLSXRange {
  s: { c: number; r: number };
  e: { c: number; r: number };
}

export interface ExcelFile {
  name: string;
  file: File;
  workbook: XLSXWorkbook | null;
  size: number;
  loaded: boolean;
}

export interface ExcelCellView {
  value: unknown;
  displayValue: string;
  formula?: string;
  style?: unknown;
}

export interface ExcelSearchHit {
  row: number;
  col: number;
}

export interface ExcelSheetRenderResult {
  sheetData: ExcelCellView[][];
  sheetHeaders: string[];
  maxRows: number;
  maxCols: number;
}
