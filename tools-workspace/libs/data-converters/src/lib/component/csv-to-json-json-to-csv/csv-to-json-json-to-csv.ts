import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationComponent } from '@tools-workspace/features-home';

type ConversionMode = 'csv-to-json' | 'json-to-csv';
type CsvLineEnding = 'auto' | 'lf' | 'crlf';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ConversionStatus {
  status: 'success' | 'error' | 'idle';
  message: string;
}

interface CsvParseResult {
  headers: string[] | null;
  rows: string[][];
}

interface MetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
  selection: string;
}

const SAMPLE_CSV = `id,name,email,active,created_at
1,Ada Lovelace,ada@example.com,true,1843-12-10
2,Alan Turing,alan@example.com,true,1950-06-07
3,Grace Hopper,grace@example.com,false,1969-03-05`;

const SAMPLE_JSON = `[
  {
    "id": 101,
    "product": "Notebook",
    "price": 12.5,
    "inStock": true
  },
  {
    "id": 102,
    "product": "Pen",
    "price": 2.25,
    "inStock": true
  },
  {
    "id": 103,
    "product": "Ruler",
    "price": 4.15,
    "inStock": false
  }
]`;

@Component({
  selector: 'lib-csv-to-json-json-to-csv',
  standalone: true,
  templateUrl: './csv-to-json-json-to-csv.html',
  styleUrls: ['./csv-to-json-json-to-csv.scss'],
  imports: [CommonModule, NgIf, NgFor, FormsModule, NavigationComponent]
})
export class CsvToJsonJsonToCsvComponent implements AfterViewInit {
  @ViewChild('csvTextarea') csvTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  readonly modes: Array<{ id: ConversionMode; label: string; description: string }> = [
    {
      id: 'csv-to-json',
      label: 'CSV → JSON',
      description: 'Import tabular data and create clean, structured JSON output.'
    },
    {
      id: 'json-to-csv',
      label: 'JSON → CSV',
      description: 'Export arrays of objects into spreadsheets with custom delimiters.'
    }
  ];

  readonly delimiterOptions = [',', ';', '\t', '|'];
  readonly lineEndingOptions: Array<{ id: CsvLineEnding; label: string }> = [
    { id: 'auto', label: 'Auto detect' },
    { id: 'lf', label: 'LF (\\n)' },
    { id: 'crlf', label: 'CRLF (\\r\\n)' }
  ];

  readonly usageSteps = [
    'Pick the direction you need: CSV → JSON or JSON → CSV.',
    'Paste or upload your data; configure delimiters, headers, and line endings.',
    'Run the conversion, then copy or download the result instantly.',
    'Use the history log to undo mistakes or repeat recent conversions.'
  ];

  readonly callouts = [
    { title: 'Flexible Delimiters', detail: 'Commas, semicolons, pipes, or tabs—switch instantly.' },
    { title: 'Header Aware', detail: 'Choose whether CSV rows include headers and detect them safely.' },
    { title: 'Shareable Output', detail: 'Copy straight to clipboard or download formatted files.' }
  ];

  conversionMode: ConversionMode = 'csv-to-json';

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

  conversionStatus: ConversionStatus = { status: 'idle', message: 'Ready to convert your data.' };
  operationHistory: HistoryEntry[] = [];

  metrics: MetricsSummary = { rows: 0, columns: 0, sizeLabel: '0 B', selection: 'CSV' };

  copyStatus: 'idle' | 'success' | 'error' = 'idle';
  isDragOver = false;
  editorLines: number[] = [];
  resultLines: number[] = [];

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

  onModeChange(mode: ConversionMode): void {
    if (this.conversionMode === mode) {
      return;
    }

    // Remove focus from dropdown to prevent tooltip persistence
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Update mode first
    this.conversionMode = mode;

    // Reset all inputs
    this.csvInput = '';
    this.jsonInput = '';
    this.resultOutput = '';

    // Reset metrics according to new mode
    this.metrics = {
      rows: 0,
      columns: 0,
      sizeLabel: '0 B',
      selection: mode === 'csv-to-json' ? 'CSV' : 'JSON'
    };

    // Reset operation history
    this.operationHistory = [];

    // Reset copy status
    this.copyStatus = 'idle';

    // Load sample data according to the new mode (this will set status and update line numbers)
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
    // Sync line numbers scroll with editor scroll
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.editor-line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  onResultsScroll(event: Event): void {
    // Sync line numbers scroll with results textarea scroll
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.results-output__line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
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
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.conversionStatus = { status: 'idle', message: 'Converting…' };
    if (this.conversionMode === 'csv-to-json') {
      this.handleCsvToJson();
    } else {
      this.handleJsonToCsv();
    }
  }

  resetWorkspace(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.loadSample();
  }

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
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
      await navigatorRef.clipboard.writeText(this.resultOutput);
      this.copyStatus = 'success';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      this.recordHistory(`Copied ${this.conversionMode === 'csv-to-json' ? 'JSON' : 'CSV'} result`);
    } catch (error) {
      console.warn('Unable to copy result to clipboard.', error);
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    }
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }
    const mimeType = this.conversionMode === 'csv-to-json' ? 'application/json' : 'text/csv';
    const blob = new Blob([this.resultOutput], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');
    const extension = this.conversionMode === 'csv-to-json' ? 'json' : 'csv';
    link.download = `converted-${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory(`Downloaded ${extension.toUpperCase()} result`);
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

  trackByHistory(_: number, entry: HistoryEntry): string {
    return `${entry.label}-${entry.timestamp}`;
  }

  private handleCsvToJson(): void {
    if (!this.csvInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste or upload CSV content to convert it into JSON. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const parsed = this.parseCsv(this.csvInput, {
      delimiter: this.csvDelimiter,
      quote: this.csvQuote || '"',
      hasHeader: this.csvHasHeader,
      trim: this.csvTrimWhitespace,
      skipEmpty: this.csvSkipEmptyLines,
      lineEnding: this.csvLineEnding
    });

    if ('error' in parsed) {
      this.conversionStatus = {
        status: 'error',
        message: `CSV Parse Error: ${parsed.error}. Please check your CSV format, delimiter, and quote characters.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const { headers, rows } = parsed;
    let json: unknown;
    if (headers) {
      json = rows.map((row) => {
        const entry: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          entry[header] = row[index] ?? '';
        });
        return entry;
      });
      this.metrics = {
        rows: rows.length,
        columns: headers.length,
        sizeLabel: this.formatBytes(new Blob([JSON.stringify(json)]).size),
        selection: 'JSON'
      };
    } else {
      json = rows;
      this.metrics = {
        rows: rows.length,
        columns: rows[0]?.length ?? 0,
        sizeLabel: this.formatBytes(new Blob([JSON.stringify(json)]).size),
        selection: 'JSON'
      };
    }

    const replacer = this.jsonSortKeys ? this.sortObjectKeys : undefined;
    this.resultOutput = JSON.stringify(
      json,
      replacer,
      this.jsonPrettyPrint ? 2 : undefined
    );
    this.updateResultLineNumbers();
    this.conversionStatus = {
      status: 'success',
      message: `Converted CSV to JSON (${rows.length} rows).`
    };
    this.recordHistory('Converted CSV to JSON');
  }

  private handleJsonToCsv(): void {
    if (!this.jsonInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste or upload JSON content to convert it into CSV. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.jsonInput);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to parse JSON input.';
      this.conversionStatus = {
        status: 'error',
        message: `JSON Parse Error: ${errorMessage}. Please check your JSON syntax and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      this.conversionStatus = {
        status: 'error',
        message: 'JSON must be an array of objects or arrays with at least one entry. Empty arrays cannot be converted to CSV.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const detectedLineEnding = this.resolveLineEnding(this.jsonInput, this.csvLineEnding);
    const csv = this.buildCsv(parsed, detectedLineEnding);
    if ('error' in csv) {
      this.conversionStatus = {
        status: 'error',
        message: `CSV Generation Error: ${csv.error}. Please ensure your JSON structure is compatible with CSV format.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    this.resultOutput = csv.value;
    this.updateResultLineNumbers();
    this.metrics = {
      rows: csv.rows,
      columns: csv.columns,
      sizeLabel: this.formatBytes(new Blob([csv.value]).size),
      selection: 'CSV'
    };
    this.conversionStatus = {
      status: 'success',
      message: `Converted JSON to CSV (${csv.rows} rows).`
    };
    this.recordHistory('Converted JSON to CSV');
  }

  private parseCsv(
    source: string,
    options: {
      delimiter: string;
      quote: string;
      hasHeader: boolean;
      trim: boolean;
      skipEmpty: boolean;
      lineEnding: CsvLineEnding;
    }
  ): CsvParseResult | { error: string } {
    const delimiter = options.delimiter;
    const quoteChar = options.quote || '"';
    const newline = this.resolveLineEnding(source, options.lineEnding);

    const rows: string[][] = [];
    let currentField = '';
    let currentRow: string[] = [];
    let insideQuotes = false;
    let pointer = 0;
    const length = source.length;

    const pushField = () => {
      currentRow.push(options.trim ? currentField.trim() : currentField);
      currentField = '';
    };

    const pushRow = () => {
      if (!(options.skipEmpty && currentRow.every((field) => field === ''))) {
        rows.push(currentRow);
      }
      currentRow = [];
    };

    while (pointer < length) {
      const char = source[pointer];
      const next = pointer + 1 < length ? source[pointer + 1] : '';

      if (char === quoteChar) {
        if (insideQuotes && next === quoteChar) {
          currentField += quoteChar;
          pointer += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (!insideQuotes && char === delimiter) {
        pushField();
      } else if (!insideQuotes && this.isNewline(source, pointer, newline)) {
        pushField();
        pushRow();
        pointer += newline.length - 1;
      } else {
        currentField += char;
      }

      pointer += 1;
    }

    pushField();
    pushRow();

    if (!rows.length) {
      return { error: 'No CSV data detected. Check delimiters or upload a different file.' };
    }

    if (options.hasHeader) {
      const headers = rows.shift() ?? [];
      if (!headers.length) {
        return { error: 'Header row is empty. Disable headers or provide valid column names.' };
      }
      return { headers, rows };
    }

    return { headers: null, rows };
  }

  private isNewline(source: string, index: number, newline: string): boolean {
    if (newline === '\r\n') {
      return source[index] === '\r' && source[index + 1] === '\n';
    }
    return source[index] === '\n';
  }

  private buildCsv(
    parsed: unknown[],
    newline: string
  ): { value: string; rows: number; columns: number } | { error: string } {
    const delimiter = this.csvDelimiter;
    const quoteChar = this.csvQuote || '"';
    const includeHeader = this.csvIncludeHeader;

    const rows: string[][] = [];
    let columns: string[] = [];

    if (this.isArrayOfObjects(parsed)) {
      const seen = new Set<string>();
      parsed.forEach((item) => {
        Object.keys(item).forEach((key) => {
          if (!seen.has(key)) {
            seen.add(key);
            columns.push(key);
          }
        });
      });

      if (this.jsonSortKeys) {
        columns = [...columns].sort((a, b) => a.localeCompare(b));
      }

      if (!columns.length) {
        return { error: 'Could not determine CSV columns from the JSON objects.' };
      }

      if (includeHeader) {
        rows.push(columns);
      }

      parsed.forEach((entry) => {
        const row = columns.map((column) => {
          const value = entry[column];
          return this.stringifyCsvValue(value, delimiter, quoteChar, newline);
        });
        rows.push(row);
      });

      return {
        value: rows.map((row) => row.join(delimiter)).join(newline),
        rows: includeHeader ? rows.length - 1 : rows.length,
        columns: columns.length
      };
    }

    if (this.isArrayOfArrays(parsed)) {
      // Validate that all arrays have the same length (or handle variable lengths)
      const firstRowLength = parsed[0]?.length ?? 0;
      if (firstRowLength === 0) {
        return { error: 'Arrays cannot be empty. Each array should contain at least one value.' };
      }

      // Check if all rows have the same length (optional validation)
      const allSameLength = parsed.every((arr) => arr.length === firstRowLength);
      if (!allSameLength && this.csvIncludeHeader) {
        // If header is included, warn but still convert
        // For arrays of arrays, headers aren't typically meaningful
      }

      parsed.forEach((rowArray) => {
        const row = rowArray.map((value) =>
          this.stringifyCsvValue(value, delimiter, quoteChar, newline)
        );
        rows.push(row);
      });

      // If includeHeader is true, we can't generate meaningful headers for arrays of arrays
      // So we skip the header row for this case
      const csvValue = rows.map((row) => row.join(delimiter)).join(newline);

      return {
        value: csvValue,
        rows: rows.length,
        columns: Math.max(...rows.map((r) => r.length), 0)
      };
    }

    return {
      error:
        'JSON must be an array of objects (preferred) or an array of arrays to convert into CSV.'
    };
  }

  private stringifyCsvValue(
    value: unknown,
    delimiter: string,
    quoteChar: string,
    newline: string
  ): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return this.wrapCsvField(value, delimiter, quoteChar, newline);
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      const stringValue = String(value);
      return this.wrapCsvField(stringValue, delimiter, quoteChar, newline);
    }

    const serialized = JSON.stringify(value);
    return this.wrapCsvField(serialized, delimiter, quoteChar, newline);
  }

  private wrapCsvField(
    value: string,
    delimiter: string,
    quoteChar: string,
    newline: string
  ): string {
    const mustQuote =
      value.includes(delimiter) ||
      value.includes('\n') ||
      value.includes('\r') ||
      value.includes(quoteChar);

    let escaped = value;
    if (value.includes(quoteChar)) {
      const regex = new RegExp(quoteChar, 'g');
      escaped = value.replace(regex, quoteChar + quoteChar);
    }

    if (mustQuote) {
      return `${quoteChar}${escaped}${quoteChar}`;
    }
    if (this.csvTrimWhitespace) {
      return escaped.trim();
    }
    return escaped;
  }

  private resolveLineEnding(source: string, option: CsvLineEnding): string {
    if (option === 'lf') {
      return '\n';
    }
    if (option === 'crlf') {
      return '\r\n';
    }
    return source.includes('\r\n') ? '\r\n' : '\n';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  }

  private updateMetrics(value: string, selection: string): void {
    const rows = value.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    const columns =
      this.conversionMode === 'csv-to-json'
        ? (value.split(/\r?\n/, 1)[0]?.split(this.csvDelimiter).length ?? 0)
        : 0;
    this.metrics = {
      rows,
      columns,
      sizeLabel: this.formatBytes(new Blob([value]).size),
      selection
    };
  }

  private sortObjectKeys(
    this: void,
    key: string,
    value: unknown
  ): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      Object.keys(value as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .forEach((childKey) => {
          sorted[childKey] = (value as Record<string, unknown>)[childKey];
        });
      return sorted;
    }
    return value;
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 6);
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
        } else if (isJson || (!isCsv && this.conversionMode === 'json-to-csv')) {
          this.conversionMode = 'json-to-csv';
          this.jsonInput = text;
          this.updateMetrics(text, 'JSON');
          this.updateEditorLineNumbers();
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded JSON file (${file.name}). Ready to convert.`
          };
        } else {
          this.conversionStatus = {
            status: 'error',
            message: `Unsupported file type: ${extension || 'unknown'}. Upload CSV or JSON.`
          };
        }
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: 'Could not read the selected file. Please try another file.'
        };
      });
  }

  private isArrayOfObjects(value: unknown[]): value is Record<string, unknown>[] {
    return (
      value.length > 0 &&
      value.every(
        (entry) =>
          entry !== null &&
          entry !== undefined &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          entry.constructor === Object
      )
    );
  }

  private isArrayOfArrays(value: unknown[]): value is unknown[][] {
    return value.length > 0 && value.every((item) => Array.isArray(item) && item.length > 0);
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
    const lines = currentInput.split(/\r?\n/).length;
    this.editorLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private updateResultLineNumbers(): void {
    const lines = this.resultOutput.split(/\r?\n/).length;
    this.resultLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }
}
