import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { DecimalPipe, NgFor, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  EXCEL_TO_JSON_ACCEPT,
  EXCEL_TO_JSON_COLUMN_TYPES,
  EXCEL_TO_JSON_HEADER_STRATEGIES,
  EXCEL_TO_JSON_HERO_HIGHLIGHTS,
  EXCEL_TO_JSON_HISTORY_LIMIT,
  EXCEL_TO_JSON_OUTPUT_FORMATS,
  EXCEL_TO_JSON_RELATED_TOOLS,
  EXCEL_TO_JSON_SAMPLE_MAPPINGS,
  EXCEL_TO_JSON_SAMPLE_PREVIEW,
  EXCEL_TO_JSON_SAMPLE_SHEET
} from '../../constants/excel-to-json.constants';
import type {
  ExcelColumnMapping,
  ExcelColumnType,
  ExcelConversionStatus,
  ExcelCopyStatus,
  ExcelDiagnostic,
  ExcelHeaderStrategy,
  ExcelHistoryEntry,
  ExcelMetricsSummary,
  ExcelOutputFormat,
  ExcelSheetPreviewRow,
  SheetJsModule,
  XlsxWorkbook,
  XlsxWorksheet
} from '../../types/excel-to-json.types';
import {
  blurActiveElement,
  buildExcelConversionOutput,
  createExcelDiagnostic,
  extractExcelRows,
  formatExcelBytes,
  isSupportedExcelFile,
  loadSheetJsLibrary,
  normalizeExcelPreviewRow,
  prependExcelHistory,
  resolveExcelHeaders,
  resolveExcelToJsonSuggestion
} from '../../utils/excel-to-json.utils';

@Component({
  selector: 'lib-excel-to-json',
  standalone: true,
  templateUrl: './excel-to-json.html',
  styleUrls: ['./excel-to-json.scss'],
  imports: [NgFor, DecimalPipe, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class ExcelToJsonComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  private fileInput: HTMLInputElement | null = null;
  private sheetjs: SheetJsModule | null = null;
  private workbook: XlsxWorkbook | null = null;

  readonly heroHighlights = EXCEL_TO_JSON_HERO_HIGHLIGHTS;
  readonly outputFormats = EXCEL_TO_JSON_OUTPUT_FORMATS;
  readonly headerStrategies = EXCEL_TO_JSON_HEADER_STRATEGIES;
  readonly columnTypes = EXCEL_TO_JSON_COLUMN_TYPES;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = EXCEL_TO_JSON_RELATED_TOOLS;

  fileName = '';
  selectedSheet = '';
  sheetNames: string[] = [];
  sheetPreview: ExcelSheetPreviewRow[] = [];

  headerStrategy: ExcelHeaderStrategy = 'auto';
  customHeadersInput = '';
  includeEmptyRows = false;
  dropEmptyColumns = true;
  convertDates = true;
  convertNumbers = true;
  trimWhitespace = true;
  outputFormat: ExcelOutputFormat = 'json-array';
  keyColumn = '';

  conversionStatus: ExcelConversionStatus = {
    status: 'idle',
    message: 'Upload an Excel file to begin conversion.'
  };

  diagnostics: ExcelDiagnostic[] = [];
  operationHistory: ExcelHistoryEntry[] = [];
  metrics: ExcelMetricsSummary = { rows: 0, columns: 0, sizeLabel: '0 KB' };

  conversionResult = '';
  copyStatus: ExcelCopyStatus = 'idle';
  isDragOver = false;

  columnMappings: ExcelColumnMapping[] = [];
  selectedColumns: string[] = [];
  dismissedSuggestionId: string | null = null;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  get hasWorksheet(): boolean {
    return this.selectedSheet.length > 0;
  }

  get canConvert(): boolean {
    return this.hasWorksheet && !!this.sheetPreview.length;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveExcelToJsonSuggestion(
      this.hasWorksheet,
      !!this.conversionResult.trim(),
      this.outputFormat,
      this.fileName,
      this.conversionStatus.status
    );
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    void this.loadWorkbook(file);
    input.value = '';
  }

  uploadFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.onchange = () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          void this.loadWorkbook(file);
        }
      };
    }
    this.fileInput.accept = EXCEL_TO_JSON_ACCEPT;
    this.fileInput.click();
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
    void this.loadWorkbook(file);
  }

  onSheetChange(sheetName: string): void {
    this.selectedSheet = sheetName;
    this.refreshPreview();
  }

  onHeaderStrategyChange(strategy: ExcelHeaderStrategy): void {
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
      this.columnMappings[index].type = type as ExcelColumnType;
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
    blurActiveElement();

    if (!this.canConvert) {
      this.conversionStatus = {
        status: 'error',
        message:
          'Select a worksheet before converting. Please upload an Excel file and select a worksheet first.'
      };
      this.conversionResult = '';
      this.diagnostics = [
        createExcelDiagnostic(
          'error',
          'Cannot convert: No worksheet selected. Please upload a file and select a worksheet.'
        )
      ];
      return;
    }

    const sheet = this.getCurrentSheet();
    if (!sheet) {
      this.conversionStatus = {
        status: 'error',
        message:
          'Unable to load the selected worksheet. Please try selecting a different worksheet or re-upload the file.'
      };
      this.conversionResult = '';
      this.diagnostics = [
        createExcelDiagnostic(
          'error',
          `Failed to load worksheet "${this.selectedSheet}". The worksheet may be corrupted or empty.`
        )
      ];
      return;
    }

    const headers = this.resolveHeaders();
    const columnMapping = this.columnMappings.filter((mapping) =>
      this.selectedColumns.length ? this.selectedColumns.includes(mapping.columnName) : true
    );

    if (!headers.length || !columnMapping.length) {
      const errorMessage =
        'No columns available for conversion. Please check your header detection settings and column mappings.';
      this.conversionStatus = {
        status: 'error',
        message: `Conversion Error: ${errorMessage}. Please check your settings and try again.`
      };
      this.conversionResult = '';
      this.diagnostics = [createExcelDiagnostic('error', errorMessage)];
      return;
    }

    const rows = this.sheetjs
      ? extractExcelRows(
          sheet,
          this.sheetjs,
          headers,
          columnMapping,
          this.headerStrategy,
          this.includeEmptyRows,
          {
            convertDates: this.convertDates,
            convertNumbers: this.convertNumbers,
            trimWhitespace: this.trimWhitespace
          }
        )
      : [];

    const outcome = buildExcelConversionOutput(
      rows,
      columnMapping,
      this.outputFormat,
      this.keyColumn
    );

    if (!outcome.ok) {
      this.conversionStatus = { status: 'error', message: outcome.message };
      this.conversionResult = '';
      this.diagnostics = [
        createExcelDiagnostic(outcome.diagnosticLevel, outcome.diagnosticMessage)
      ];
      return;
    }

    this.conversionResult = outcome.output;
    this.copyStatus = 'idle';
    this.diagnostics = [];
    this.conversionStatus = { status: 'success', message: outcome.message };
    this.recordHistory(
      `Converted worksheet "${this.selectedSheet}" to ${this.outputFormat.toUpperCase()}`
    );
    this.toast.success('Conversion complete');
  }

  formatBytes(bytes: number): string {
    return formatExcelBytes(bytes);
  }

  resetWorkspace(): void {
    blurActiveElement();
    void this.loadSample();
    this.toast.info('Sample data reloaded');
  }

  async copyResult(): Promise<void> {
    if (!this.conversionResult.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    const ok = await dcCopyText(this.toast, this.conversionResult, 'Output');
    this.copyStatus = ok ? 'success' : 'error';
    if (ok) {
      this.recordHistory('Copied conversion output');
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  downloadResult(): void {
    if (!this.conversionResult.trim()) {
      return;
    }
    const extension = this.outputFormat === 'csv' ? 'csv' : 'json';
    const mimeType = this.outputFormat === 'csv' ? 'text/csv' : 'application/json';
    const baseName = this.fileName ? this.fileName.replace(/\.[^.]+$/, '') : 'excel-export';
    const filename = `${baseName}-${this.selectedSheet || 'sheet'}-${dcDownloadTimestamp()}.${extension}`;

    try {
      dcDownloadBlob(
        new Blob([this.conversionResult], { type: `${mimeType};charset=utf-8` }),
        filename
      );
      this.recordHistory('Downloaded conversion result');
      this.toast.success(`${extension.toUpperCase()} downloaded`);
    } catch {
      this.toast.error('Could not download result');
    }
  }

  trackByHistory = (_index: number, entry: ExcelHistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByDiagnostic = (_index: number, diagnostic: ExcelDiagnostic): string => diagnostic.id;

  trackByColumn = (_index: number, mapping: ExcelColumnMapping): string => mapping.columnName;

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

    this.sheetPreview = previewRows.slice(0, 10).map((row) => normalizeExcelPreviewRow(row));
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

  private async ensureSheetJS(): Promise<SheetJsModule> {
    this.sheetjs = await loadSheetJsLibrary(
      this.sheetjs,
      isPlatformBrowser(this.platformId)
    );
    return this.sheetjs;
  }

  private async loadWorkbook(file: File): Promise<void> {
    if (!isSupportedExcelFile(file)) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Please upload an Excel file (.xlsx, .xls, .csv, .ods, etc.).`
      };
      this.sheetNames = [];
      this.selectedSheet = '';
      this.sheetPreview = [];
      this.columnMappings = [];
      this.conversionResult = '';
      this.diagnostics = [
        createExcelDiagnostic(
          'error',
          `File type not supported: ${file.name}. Supported formats: .xlsx, .xls, .csv, .ods, .fods`
        )
      ];
      this.toast.error('Unsupported file type');
      return;
    }

    try {
      const sheetjs = await this.ensureSheetJS();
      this.fileName = file.name;

      if (file.size === 0) {
        throw new Error('The uploaded file is empty.');
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      const workbook = sheetjs.read(buffer, { type: 'array', cellDates: true });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('The Excel file contains no worksheets.');
      }

      this.workbook = workbook;
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
        message: `Workbook loaded (${workbook.SheetNames.length} worksheet(s)). Select a worksheet and convert.`
      };
      this.diagnostics = [];
      this.refreshPreview();
      this.toast.info(`Loaded ${file.name}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load Excel workbook.';
      this.conversionStatus = {
        status: 'error',
        message: `File Load Error: ${errorMessage}. Please ensure the file is a valid Excel workbook and try again.`
      };
      this.sheetNames = [];
      this.selectedSheet = '';
      this.sheetPreview = [];
      this.columnMappings = [];
      this.conversionResult = '';
      this.workbook = null;
      this.diagnostics = [createExcelDiagnostic('error', errorMessage)];
      this.toast.error('Could not load workbook');
    }
  }

  private getCurrentSheet(): XlsxWorksheet | null {
    if (!this.workbook || !this.selectedSheet) {
      return null;
    }
    return this.workbook.Sheets[this.selectedSheet] ?? null;
  }

  private resolveHeaders(sheet: XlsxWorksheet | null = null): string[] {
    const worksheet = sheet ?? this.getCurrentSheet();
    if (!worksheet || !this.sheetjs) {
      return [];
    }
    return resolveExcelHeaders(
      worksheet,
      this.sheetjs,
      this.headerStrategy,
      this.customHeadersInput
    );
  }

  private recordHistory(label: string): void {
    this.operationHistory = prependExcelHistory(
      this.operationHistory,
      label,
      EXCEL_TO_JSON_HISTORY_LIMIT
    );
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
    this.selectedSheet = EXCEL_TO_JSON_SAMPLE_SHEET;
    this.sheetNames = [EXCEL_TO_JSON_SAMPLE_SHEET];
    this.sheetPreview = EXCEL_TO_JSON_SAMPLE_PREVIEW.map((row) => ({ ...row }));
    this.columnMappings = EXCEL_TO_JSON_SAMPLE_MAPPINGS.map((mapping) => ({ ...mapping }));
    this.selectedColumns = this.columnMappings.map((mapping) => mapping.columnName);
    this.metrics = { rows: 3, columns: 4, sizeLabel: '2 KB', fileName: this.fileName };
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample data loaded. Convert to preview JSON output.'
    };
    this.conversionResult = '';
    this.operationHistory = [];
    this.diagnostics = [];
    this.workbook = null;
  }
}
