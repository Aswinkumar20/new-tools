import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { NavigationComponent } from '@tools-workspace/features-home';

type CopyStatus = 'idle' | 'success' | 'error';
type ConversionState = 'idle' | 'success' | 'error';

type OutputFormat = 'json-array' | 'json-object' | 'csv';
type HeaderStrategy = 'auto' | 'first-row' | 'custom';

type ColumnType = 'string' | 'number' | 'boolean' | 'date';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ConversionStatus {
  status: ConversionState;
  message: string;
}

interface MetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
  fileName?: string;
}

interface Diagnostic {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

interface ColumnMapping {
  columnName: string;
  keyName: string;
  type: ColumnType;
}

interface SheetPreviewRow {
  [key: string]: string | number | boolean | null;
}

interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: Record<string, XLSXWorksheet>;
}

interface XLSXWorksheet {
  '!ref'?: string;
  [cell: string]: any;
}

interface SheetJSModule {
  read(data: Uint8Array, options?: any): XLSXWorkbook;
  utils: {
    sheet_to_json<T>(worksheet: XLSXWorksheet, options?: any): T[];
    decode_range(range: string): { s: { r: number; c: number }; e: { r: number; c: number } };
  };
  write(workbook: XLSXWorkbook, options: any): string | ArrayBuffer;
}

//@ts-ignore
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';

@Component({
  selector: 'lib-excel-to-json',
  standalone: true,
  templateUrl: './excel-to-json.html',
  styleUrls: ['./excel-to-json.scss'],
  imports: [CommonModule, NgIf, NgFor, FormsModule, NavigationComponent]
})
export class ExcelToJsonComponent {
  private sheetjs: SheetJSModule | null = null;

  readonly heroHighlights = [
    {
      title: 'Multi-sheet support',
      detail: 'Upload workbooks and choose which worksheet to convert.'
    },
    {
      title: 'Flexible headers',
      detail: 'Use the first row, auto-detect headers, or define custom key names.'
    },
    {
      title: 'Clean output',
      detail: 'Format dates, coerce types, filter columns, and export JSON or CSV.'
    }
  ];

  readonly outputFormats: Array<{ value: OutputFormat; label: string }> = [
    { value: 'json-array', label: 'Array of objects (JSON)' },
    { value: 'json-object', label: 'Keyed object (JSON)' },
    { value: 'csv', label: 'CSV' }
  ];

  readonly headerStrategies: Array<{ value: HeaderStrategy; label: string }> = [
    { value: 'auto', label: 'Auto-detect headers' },
    { value: 'first-row', label: 'Use first row as headers' },
    { value: 'custom', label: 'Define custom headers' }
  ];

  readonly columnTypes: Array<{ value: ColumnType; label: string }> = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'date', label: 'Date' }
  ];

  fileName = '';
  selectedSheet = '';
  sheetNames: string[] = [];
  sheetPreview: SheetPreviewRow[] = [];

  headerStrategy: HeaderStrategy = 'auto';
  customHeadersInput = '';
  includeEmptyRows = false;
  dropEmptyColumns = true;
  convertDates = true;
  convertNumbers = true;
  trimWhitespace = true;
  outputFormat: OutputFormat = 'json-array';
  keyColumn = '';

  conversionStatus: ConversionStatus = {
    status: 'idle',
    message: 'Upload an Excel file to begin conversion.'
  };

  diagnostics: Diagnostic[] = [];
  operationHistory: HistoryEntry[] = [];
  metrics: MetricsSummary = { rows: 0, columns: 0, sizeLabel: '0 KB' };

  conversionResult = '';
  copyStatus: CopyStatus = 'idle';
  isDragOver = false;

  columnMappings: ColumnMapping[] = [];
  selectedColumns: string[] = [];

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  get hasWorksheet(): boolean {
    return this.selectedSheet.length > 0;
  }

  get canConvert(): boolean {
    return this.hasWorksheet && !!this.sheetPreview.length;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.loadWorkbook(file);
    input.value = '';
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    this.loadWorkbook(file);
  }

  onSheetChange(sheetName: string): void {
    this.selectedSheet = sheetName;
    this.refreshPreview();
  }

  onHeaderStrategyChange(strategy: HeaderStrategy): void {
    this.headerStrategy = strategy;
    this.refreshColumnMappings();
  }

  toggleIncludeEmptyRows(): void {
    this.includeEmptyRows = !this.includeEmptyRows;
  }

  toggleDropEmptyColumns(): void {
    this.dropEmptyColumns = !this.dropEmptyColumns;
    this.refreshColumnMappings();
  }

  toggleConvertDates(): void {
    this.convertDates = !this.convertDates;
  }

  toggleConvertNumbers(): void {
    this.convertNumbers = !this.convertNumbers;
  }

  toggleTrimWhitespace(): void {
    this.trimWhitespace = !this.trimWhitespace;
  }

  updateKeyColumn(value: string): void {
    this.keyColumn = value;
  }

  updateColumnType(index: number, type: string): void {
    if (this.columnTypes.some((item) => item.value === type)) {
      this.columnMappings[index].type = type as ColumnType;
    }
  }

  updateColumnKey(index: number, value: string): void {
    this.columnMappings[index].keyName = value;
  }

  toggleColumnSelection(column: string): void {
    if (this.selectedColumns.includes(column)) {
      this.selectedColumns = this.selectedColumns.filter((col) => col !== column);
    } else {
      this.selectedColumns = [...this.selectedColumns, column];
    }
  }

  convertWorkbook(): void {
    if (!this.canConvert) {
      this.conversionStatus = {
        status: 'error',
        message: 'Select a worksheet before converting.'
      };
      return;
    }

    const sheet = this.getCurrentSheet();
    if (!sheet) {
      this.conversionStatus = {
        status: 'error',
        message: 'Unable to load the selected worksheet.'
      };
      return;
    }

    const headers = this.resolveHeaders();
    const columnMapping = this.columnMappings.filter((mapping) =>
      this.selectedColumns.length ? this.selectedColumns.includes(mapping.columnName) : true
    );

    try {
      const rows = this.extractRows(sheet, headers, columnMapping);
      let output = '';
      if (this.outputFormat === 'csv') {
        output = this.convertRowsToCsv(rows, columnMapping);
      } else if (this.outputFormat === 'json-object') {
        output = this.convertRowsToKeyedObject(rows, columnMapping);
      } else {
        output = JSON.stringify(rows, null, 2);
      }
      this.conversionResult = output;
      this.copyStatus = 'idle';
      this.conversionStatus = {
        status: 'success',
        message: `Conversion successful: ${rows.length} rows exported.`
      };
      this.recordHistory(`Converted worksheet "${this.selectedSheet}" to ${this.outputFormat.toUpperCase()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Conversion failed due to an unknown error.';
      this.conversionStatus = {
        status: 'error',
        message
      };
      this.conversionResult = '';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  resetWorkspace(): void {
    this.loadSample();
  }

  async copyResult(): Promise<void> {
    if (!this.conversionResult.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    try {
      const navigatorRef = (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
      if (!navigatorRef?.clipboard?.writeText) {
        this.copyStatus = 'error';
        setTimeout(() => (this.copyStatus = 'idle'), 1500);
        return;
      }
      await navigatorRef.clipboard.writeText(this.conversionResult);
      this.copyStatus = 'success';
      this.recordHistory('Copied conversion output');
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    } catch {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    }
  }

  downloadResult(): void {
    if (!this.conversionResult.trim()) {
      return;
    }
    const extension = this.outputFormat === 'csv' ? 'csv' : 'json';
    const mimeType = this.outputFormat === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([this.conversionResult], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');
    const baseName = this.fileName ? this.fileName.replace(/\.[^.]+$/, '') : 'excel-export';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}-${this.selectedSheet || 'sheet'}-${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory('Downloaded conversion result');
  }

  trackByHistory = (_index: number, entry: HistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByDiagnostic = (_index: number, diagnostic: Diagnostic): string => diagnostic.id;

  trackByColumn = (_index: number, mapping: ColumnMapping): string => mapping.columnName;

  private async ensureSheetJS(): Promise<SheetJSModule> {
    if (this.sheetjs) {
      return this.sheetjs;
    }

    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Excel parsing is only available in a browser environment.');
    }

    if ((globalThis as any).XLSX) {
      this.sheetjs = (globalThis as any).XLSX as SheetJSModule;
      return this.sheetjs;
    }

    const script = document.createElement('script');
    script.src = SHEETJS_URL;
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => {
        this.sheetjs = (globalThis as any).XLSX as SheetJSModule;
        resolve(this.sheetjs);
      };
      script.onerror = () => reject(new Error('Unable to load Excel parsing library.'));
    });
  }

  private async loadWorkbook(file: File): Promise<void> {
    try {
      const sheetjs = await this.ensureSheetJS();
      this.fileName = file.name;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const workbook = sheetjs.read(buffer, { type: 'array', cellDates: true });
      this.sheetNames = workbook.SheetNames;
      this.selectedSheet = this.sheetNames[0] ?? '';
      this.metrics = {
        rows: 0,
        columns: 0,
        sizeLabel: this.formatBytes(file.size),
        fileName: file.name
      };
      this.conversionStatus = {
        status: 'idle',
        message: 'Workbook loaded. Select a worksheet and convert.'
      };
      (this as any)._workbook = workbook;
      this.refreshPreview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Excel workbook.';
      this.conversionStatus = {
        status: 'error',
        message
      };
      this.sheetNames = [];
      this.selectedSheet = '';
      this.sheetPreview = [];
      this.columnMappings = [];
      this.conversionResult = '';
    }
  }

  private getCurrentWorkbook(): XLSXWorkbook | null {
    return (this as any)._workbook ?? null;
  }

  private getCurrentSheet(): XLSXWorksheet | null {
    const workbook = this.getCurrentWorkbook();
    if (!workbook || !this.selectedSheet) {
      return null;
    }
    return workbook.Sheets[this.selectedSheet] ?? null;
  }

  refreshPreview(): void {
    const sheet = this.getCurrentSheet();
    if (!sheet) {
      this.sheetPreview = [];
      this.columnMappings = [];
      return;
    }

    const headers = this.resolveHeaders(sheet);
    this.columnMappings = headers.map((header) => ({
      columnName: header,
      keyName: header,
      type: 'string'
    }));
    this.selectedColumns = headers.slice();

    const sheetjs = this.sheetjs;
    if (!sheetjs) {
      this.sheetPreview = [];
      return;
    }

    const previewRows = sheetjs.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: headers,
      range: this.headerStrategy === 'first-row' ? 1 : 0,
      raw: false,
      defval: ''
    });

    this.sheetPreview = previewRows.slice(0, 10).map((row) => this.normalizePreviewRow(row));
    this.metrics = {
      ...this.metrics,
      rows: previewRows.length,
      columns: headers.length
    };
  }

  refreshColumnMappings(): void {
    const sheet = this.getCurrentSheet();
    if (!sheet) {
      this.columnMappings = [];
      return;
    }
    const headers = this.resolveHeaders(sheet);
    this.columnMappings = headers.map((header) => ({
      columnName: header,
      keyName: header,
      type: 'string'
    }));
    this.selectedColumns = headers.slice();
  }

  private resolveHeaders(sheet: XLSXWorksheet | null = null): string[] {
    const worksheet = sheet ?? this.getCurrentSheet();
    if (!worksheet) {
      return [];
    }

    const sheetjs = this.sheetjs;
    if (!sheetjs) {
      return [];
    }

    const range = worksheet['!ref'] ? sheetjs.utils.decode_range(worksheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    const headers: string[] = [];

    if (this.headerStrategy === 'auto' || this.headerStrategy === 'first-row') {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const cellAddress = this.getCellAddress(range.s.r, c);
        const cell = worksheet[cellAddress];
        let header = cell && cell.v ? String(cell.v).trim() : '';
        if (!header) {
          header = `column_${c - range.s.c + 1}`;
        }
        headers.push(header);
      }
      return headers;
    }

    if (this.headerStrategy === 'custom') {
      const trimmed = this.customHeadersInput.split(',').map((header) => header.trim()).filter((header) => header.length > 0);
      return trimmed.length ? trimmed : headers;
    }

    return headers;
  }

  private getCellAddress(row: number, column: number): string {
    const letters: string[] = [];
    let temp = column;
    do {
      letters.unshift(String.fromCharCode(65 + (temp % 26)));
      temp = Math.floor(temp / 26) - 1;
    } while (temp >= 0);
    return `${letters.join('')}${row + 1}`;
  }

  private normalizePreviewRow(row: Record<string, unknown>): SheetPreviewRow {
    const preview: SheetPreviewRow = {};
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

  private extractRows(
    sheet: XLSXWorksheet,
    headers: string[],
    mappings: ColumnMapping[]
  ): Array<Record<string, unknown>> {
    const sheetjs = this.sheetjs;
    if (!sheetjs) {
      return [];
    }

    const headerRow = this.headerStrategy === 'first-row' ? 1 : 0;
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
        const coercedValue = this.castValue(rawValue, mapping.type);
        const finalValue = typeof coercedValue === 'string' && this.trimWhitespace
          ? coercedValue.trim()
          : coercedValue;
        processed[mapping.keyName || mapping.columnName] = finalValue;
      }

      if (!this.includeEmptyRows) {
        const hasValue = Object.values(processed).some((value) => value !== '' && value !== null && value !== undefined);
        if (!hasValue) {
          continue;
        }
      }

      processedRows.push(processed);
    }

    return processedRows;
  }

  private castValue(value: unknown, type: ColumnType): unknown {
    if (type === 'string') {
      return value === undefined || value === null ? '' : String(value);
    }
    if (type === 'number') {
      if (!this.convertNumbers) {
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
      if (!this.convertDates) {
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

  private convertRowsToCsv(rows: Array<Record<string, unknown>>, mappings: ColumnMapping[]): string {
    if (!rows.length) {
      return '';
    }
    const headers = mappings.map((mapping) => mapping.keyName || mapping.columnName);
    const lines = [headers.join(',')];

    for (const row of rows) {
      const values = headers.map((header) => this.escapeCsvValue(row[header]));
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private convertRowsToKeyedObject(rows: Array<Record<string, unknown>>, mappings: ColumnMapping[]): string {
    const key = this.keyColumn && mappings.some((mapping) => mapping.keyName === this.keyColumn)
      ? this.keyColumn
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

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private sanitizeDiagnostics(): void {
    this.diagnostics = this.diagnostics.slice(0, 6);
  }

  private sanitizeWarnings(message: string): void {
    this.diagnostics.push({
      id: this.createDiagnosticId(),
      level: 'warning',
      message
    });
    this.sanitizeDiagnostics();
  }

  private updateDiagnostics(message: string, level: 'info' | 'warning' | 'error'): void {
    this.diagnostics.unshift({
      id: this.createDiagnosticId(),
      level,
      message
    });
    this.sanitizeDiagnostics();
  }

  private sanitizePreviewIfNeeded(rows: SheetPreviewRow[]): SheetPreviewRow[] {
    if (!this.dropEmptyColumns) {
      return rows;
    }

    const columns = this.columnMappings.map((mapping) => mapping.columnName);
    const populatedColumns = columns.filter((column) => rows.some((row) => row[column] !== ''));
    return rows.map((row) => {
      const filtered: SheetPreviewRow = {};
      populatedColumns.forEach((column) => {
        filtered[column] = row[column] ?? '';
      });
      return filtered;
    });
  }

  private createDiagnosticId(): string {
    return `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 6);
  }

  private async loadSample(): Promise<void> {
    if (!this.sheetjs && isPlatformBrowser(this.platformId)) {
      await this.ensureSheetJS().catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: 'Unable to initialise spreadsheet parser.'
        };
      });
    }

    this.fileName = 'sample.xlsx';
    this.selectedSheet = 'Cities';
    this.sheetNames = ['Cities'];
    this.sheetPreview = [
      { City: 'Tokyo', Country: 'Japan', Population: '37,435,191', Updated: '2025-01-01' },
      { City: 'Delhi', Country: 'India', Population: '29,399,141', Updated: '2025-01-02' },
      { City: 'São Paulo', Country: 'Brazil', Population: '21,846,507', Updated: '2025-01-03' }
    ];
    this.columnMappings = [
      { columnName: 'City', keyName: 'city', type: 'string' },
      { columnName: 'Country', keyName: 'country', type: 'string' },
      { columnName: 'Population', keyName: 'population', type: 'number' },
      { columnName: 'Updated', keyName: 'updated', type: 'date' }
    ];
    this.selectedColumns = this.columnMappings.map((mapping) => mapping.columnName);
    this.metrics = { rows: 3, columns: 4, sizeLabel: '2 KB', fileName: this.fileName };
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample data loaded. Convert to preview JSON output.'
    };
    this.conversionResult = '';
    this.operationHistory = [];
    this.diagnostics = [];
  }
}
