import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  CSV_JSON_CALLOUTS,
  CSV_JSON_DELIMITER_OPTIONS,
  CSV_JSON_HISTORY_LIMIT,
  CSV_JSON_LINE_ENDING_OPTIONS,
  CSV_JSON_MODES,
  CSV_JSON_RELATED_TOOLS,
  CSV_JSON_USAGE_STEPS,
  SAMPLE_CSV,
  SAMPLE_JSON
} from '../../constants/csv-to-json-json-to-csv.constants';
import type {
  CsvJsonConversionMode,
  CsvJsonConversionStatus,
  CsvJsonHistoryEntry,
  CsvJsonMetricsSummary,
  CsvLineEnding
} from '../../types/csv-to-json-json-to-csv.types';
import {
  blurActiveElement,
  buildLineNumberList,
  computeInputMetrics,
  convertCsvToJson,
  convertJsonToCsv,
  prependCsvJsonHistory,
  resolveCsvJsonSuggestion
} from '../../utils/csv-to-json-json-to-csv.utils';

@Component({
  selector: 'lib-csv-to-json-json-to-csv',
  standalone: true,
  templateUrl: './csv-to-json-json-to-csv.html',
  styleUrls: ['./csv-to-json-json-to-csv.scss'],
  imports: [NgIf, NgFor, DecimalPipe, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class CsvToJsonJsonToCsvComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;

  readonly modes = CSV_JSON_MODES;
  readonly delimiterOptions = [...CSV_JSON_DELIMITER_OPTIONS];
  readonly lineEndingOptions = CSV_JSON_LINE_ENDING_OPTIONS;
  readonly usageSteps = CSV_JSON_USAGE_STEPS;
  readonly callouts = CSV_JSON_CALLOUTS;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = CSV_JSON_RELATED_TOOLS;

  conversionMode: CsvJsonConversionMode = 'csv-to-json';

  csvInput = '';
  jsonInput = '';
  resultOutput = '';

  csvDelimiter = this.delimiterOptions[0];
  csvQuote = '"';
  csvHasHeader = true;
  csvTrimWhitespace = true;
  csvSkipEmptyLines = true;
  csvLineEnding: CsvLineEnding = 'auto';

  jsonPrettyPrint = true;
  jsonSortKeys = false;
  csvIncludeHeader = true;

  conversionStatus: CsvJsonConversionStatus = {
    status: 'idle',
    message: 'Ready to convert your data.'
  };
  operationHistory: CsvJsonHistoryEntry[] = [];

  metrics: CsvJsonMetricsSummary = {
    rows: 0,
    columns: 0,
    sizeLabel: '0 B',
    selection: 'CSV'
  };

  copyStatus: 'idle' | 'success' | 'error' = 'idle';
  isDragOver = false;
  editorLines: number[] = [];
  resultLines: number[] = [];
  dismissedSuggestionId: string | null = null;

  constructor() {
    this.loadSample();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
  }

  get modeDescription(): string | undefined {
    return this.modes.find((mode) => mode.id === this.conversionMode)?.description;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const input = this.conversionMode === 'csv-to-json' ? this.csvInput : this.jsonInput;
    const suggestion = resolveCsvJsonSuggestion(
      this.conversionMode,
      input,
      this.conversionStatus.status,
      !!this.resultOutput.trim()
    );
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  onModeChange(mode: CsvJsonConversionMode): void {
    if (this.conversionMode === mode) {
      return;
    }

    blurActiveElement();
    this.conversionMode = mode;
    this.csvInput = '';
    this.jsonInput = '';
    this.resultOutput = '';
    this.metrics = {
      rows: 0,
      columns: 0,
      sizeLabel: '0 B',
      selection: mode === 'csv-to-json' ? 'CSV' : 'JSON'
    };
    this.operationHistory = [];
    this.copyStatus = 'idle';
    this.loadSample();
  }

  onCsvInputChange(value: string): void {
    this.csvInput = value;
    this.updateMetrics(value, 'CSV');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'csv-to-json') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert CSV to JSON.' };
    }
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
    this.updateMetrics(value, 'JSON');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'json-to-csv') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert JSON to CSV.' };
    }
  }

  onEditorScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = this.inputLineNumbers?.nativeElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  onResultsScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = this.outputLineNumbers?.nativeElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  copyInput(): void {
    const text = this.conversionMode === 'csv-to-json' ? this.csvInput : this.jsonInput;
    void this.copyText(text, 'Input');
  }

  uploadFile(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.onchange = () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          this.readFile(file);
        }
      };
    }
    this.fileInput.accept =
      this.conversionMode === 'csv-to-json' ? '.csv,text/csv' : '.json,application/json';
    this.fileInput.click();
  }

  toggleHeaderUsage(): void {
    this.csvHasHeader = !this.csvHasHeader;
  }

  toggleTrim(): void {
    this.csvTrimWhitespace = !this.csvTrimWhitespace;
  }

  toggleSkipEmptyLines(): void {
    this.csvSkipEmptyLines = !this.csvSkipEmptyLines;
  }

  togglePrettyPrint(): void {
    this.jsonPrettyPrint = !this.jsonPrettyPrint;
  }

  toggleSortKeys(): void {
    this.jsonSortKeys = !this.jsonSortKeys;
  }

  toggleIncludeHeader(): void {
    this.csvIncludeHeader = !this.csvIncludeHeader;
  }

  convert(): void {
    blurActiveElement();
    this.conversionStatus = { status: 'idle', message: 'Converting…' };
    if (this.conversionMode === 'csv-to-json') {
      this.applyCsvToJson();
    } else {
      this.applyJsonToCsv();
    }
  }

  resetWorkspace(): void {
    blurActiveElement();
    this.loadSample();
    this.toast.info('Sample data reloaded');
  }

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    const label = this.conversionMode === 'csv-to-json' ? 'JSON' : 'CSV';
    const ok = await dcCopyText(this.toast, this.resultOutput, 'Output');
    if (ok) {
      this.copyStatus = 'success';
      this.recordHistory(`Copied ${label} result`);
    } else {
      this.copyStatus = 'error';
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }

    const mimeType = this.conversionMode === 'csv-to-json' ? 'application/json' : 'text/csv';
    const extension = this.conversionMode === 'csv-to-json' ? 'json' : 'csv';
    const filename = `converted-${dcDownloadTimestamp()}.${extension}`;

    try {
      dcDownloadBlob(
        new Blob([this.resultOutput], { type: `${mimeType};charset=utf-8` }),
        filename
      );
      this.recordHistory(`Downloaded ${extension.toUpperCase()} result`);
      this.toast.success(`${extension.toUpperCase()} downloaded`);
    } catch {
      this.toast.error('Could not download result');
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.readFile(file);
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
    this.readFile(file);
  }

  trackByHistory(_: number, entry: CsvJsonHistoryEntry): string {
    return `${entry.label}-${entry.timestamp}`;
  }

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private applyCsvToJson(): void {
    const outcome = convertCsvToJson(
      this.csvInput,
      {
        delimiter: this.csvDelimiter,
        quote: this.csvQuote || '"',
        hasHeader: this.csvHasHeader,
        trim: this.csvTrimWhitespace,
        skipEmpty: this.csvSkipEmptyLines,
        lineEnding: this.csvLineEnding
      },
      this.jsonPrettyPrint,
      this.jsonSortKeys
    );

    if (!outcome.ok) {
      this.conversionStatus = { status: 'error', message: outcome.message };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    this.resultOutput = outcome.output;
    this.metrics = outcome.metrics;
    this.updateResultLineNumbers();
    this.conversionStatus = { status: 'success', message: outcome.message };
    this.recordHistory('Converted CSV to JSON');
  }

  private applyJsonToCsv(): void {
    const outcome = convertJsonToCsv(this.jsonInput, this.csvLineEnding, {
      delimiter: this.csvDelimiter,
      quote: this.csvQuote || '"',
      includeHeader: this.csvIncludeHeader,
      sortKeys: this.jsonSortKeys,
      trimWhitespace: this.csvTrimWhitespace
    });

    if (!outcome.ok) {
      this.conversionStatus = { status: 'error', message: outcome.message };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    this.resultOutput = outcome.output;
    this.metrics = outcome.metrics;
    this.updateResultLineNumbers();
    this.conversionStatus = { status: 'success', message: outcome.message };
    this.recordHistory('Converted JSON to CSV');
  }

  private updateMetrics(value: string, selection: string): void {
    this.metrics = computeInputMetrics(
      value,
      selection,
      this.conversionMode,
      this.csvDelimiter
    );
  }

  private recordHistory(label: string): void {
    this.operationHistory = prependCsvJsonHistory(
      this.operationHistory,
      label,
      CSV_JSON_HISTORY_LIMIT
    );
  }

  private readFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isCsv = extension === 'csv';
    const isJson = extension === 'json';

    file
      .text()
      .then((text) => {
        if (isCsv || (!isJson && this.conversionMode === 'csv-to-json')) {
          this.conversionMode = 'csv-to-json';
          this.csvInput = text;
          this.updateMetrics(text, 'CSV');
          this.updateEditorLineNumbers();
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded CSV file (${file.name}). Ready to convert.`
          };
          this.toast.info(`Loaded ${file.name}`);
        } else if (isJson || (!isCsv && this.conversionMode === 'json-to-csv')) {
          this.conversionMode = 'json-to-csv';
          this.jsonInput = text;
          this.updateMetrics(text, 'JSON');
          this.updateEditorLineNumbers();
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded JSON file (${file.name}). Ready to convert.`
          };
          this.toast.info(`Loaded ${file.name}`);
        } else {
          this.conversionStatus = {
            status: 'error',
            message: `Unsupported file type: ${extension || 'unknown'}. Upload CSV or JSON.`
          };
          this.toast.error('Unsupported file type');
        }
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: 'Could not read the selected file. Please try another file.'
        };
        this.toast.error('Could not read file');
      });
  }

  private loadSample(): void {
    if (this.conversionMode === 'csv-to-json') {
      this.csvInput = SAMPLE_CSV;
      this.jsonInput = '';
      this.resultOutput = '';
      this.updateMetrics(this.csvInput, 'CSV');
      this.updateEditorLineNumbers();
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'idle',
        message: 'Sample CSV loaded. Adjust options and convert when ready.'
      };
    } else {
      this.jsonInput = SAMPLE_JSON;
      this.csvInput = '';
      this.resultOutput = '';
      this.updateMetrics(this.jsonInput, 'JSON');
      this.updateEditorLineNumbers();
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'idle',
        message: 'Sample JSON loaded. Adjust options and convert when ready.'
      };
    }
    this.operationHistory = [];
    this.copyStatus = 'idle';
  }

  private updateEditorLineNumbers(): void {
    const currentInput = this.conversionMode === 'csv-to-json' ? this.csvInput : this.jsonInput;
    this.editorLines = buildLineNumberList(currentInput);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildLineNumberList(this.resultOutput);
  }
}
