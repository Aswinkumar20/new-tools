import { Component, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

type DiagnosticLevel = 'error' | 'warning' | 'info';

type CopyStatus = 'idle' | 'success' | 'error';

type LintState = 'idle' | 'success' | 'error';

type PreviewMode = 'formatted' | 'minified';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface Diagnostic {
  id: string;
  level: DiagnosticLevel;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

interface ConversionStatus {
  status: LintState;
  message: string;
}

interface MetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
  selection: string;
}

interface SanitizeResult {
  text: string;
  transformations: string[];
  warnings: string[];
}

const SAMPLE_JSON = `{
  "meta": {
    "title": "World Cities",
    "generatedAt": "2025-10-22T10:00:00Z",
    "source": "https://example.com/api/cities"
  },
  "cities": [
    {
      "name": "Tokyo",
      "country": "Japan",
      "population": 37435191,
      "coordinates": { "lat": 35.6762, "lng": 139.6503 }
    },
    {
      "name": "Delhi",
      "country": "India",
      "population": 29399141,
      "coordinates": { "lat": 28.7041, "lng": 77.1025 }
    },
    {
      "name": "São Paulo",
      "country": "Brazil",
      "population": 21846507,
      "coordinates": { "lat": -23.5558, "lng": -46.6396 }
    }
  ]
}`;

@Component({
  selector: 'lib-json-linter-viewer',
  standalone: true,
  templateUrl: './json-linter-viewer.html',
  styleUrls: ['./json-linter-viewer.scss'],
  imports: [CommonModule, NgFor, FormsModule, Navigation, TooltipDirective]
})
export class JsonLinterViewerComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);

  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;
  readonly indentOptions = [2, 4, 6];
  readonly sampleJson = SAMPLE_JSON;
  readonly heroHighlights = [
    {
      title: 'Instant validation',
      detail: 'Surface syntax errors with precise line and column feedback before production.'
    },
    {
      title: 'Smart clean-up',
      detail: 'Optionally strip comments or trailing commas, and sort object keys for consistency.'
    },
    {
      title: 'Shareable output',
      detail: 'Copy to clipboard or download formatted/minified JSON with one click.'
    }
  ];

  jsonInput = '';
  resultOutput = '';

  indentSize = this.indentOptions[0];
  sortKeys = false;
  allowComments = false;
  allowTrailingCommas = false;
  autoPreviewMode: PreviewMode = 'formatted';

  diagnostics: Diagnostic[] = [];
  operationHistory: HistoryEntry[] = [];

  conversionStatus: ConversionStatus = {
    status: 'idle',
    message: 'Load the sample or paste JSON to begin linting.'
  };

  metrics: MetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B',
    selection: 'JSON input'
  };

  copyStatus: CopyStatus = 'idle';
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

  get previewLabel(): string {
    return this.autoPreviewMode === 'formatted' ? 'Formatted JSON' : 'Minified JSON';
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
    this.updateEditorLineNumbers();
    this.updateMetrics(value, 'JSON input');
    this.resultOutput = '';
    this.updateResultLineNumbers();
    this.diagnostics = [];
    this.conversionStatus = {
      status: 'idle',
      message: 'Ready to lint the provided JSON.'
    };
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
    void this.copyText(this.jsonInput);
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
    this.fileInput.accept = 'application/json,.json';
    this.fileInput.click();
  }

  private async copyText(text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn('Unable to copy to clipboard.', error);
    }
  }

  onIndentChange(size: number): void {
    this.indentSize = size;
  }

  toggleSortKeys(): void {
    this.sortKeys = !this.sortKeys;
  }

  toggleAllowComments(): void {
    this.allowComments = !this.allowComments;
  }

  toggleAllowTrailingCommas(): void {
    this.allowTrailingCommas = !this.allowTrailingCommas;
  }

  setPreviewMode(mode: PreviewMode): void {
    this.autoPreviewMode = mode;
    if (this.resultOutput) {
      this.rebuildPreviewFromLastResult();
    }
    // Remove focus from select to prevent tooltip persistence
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  validateJson(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!this.jsonInput.trim().length) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste JSON or load the sample before validating. The input field is empty.'
      };
      this.diagnostics = [
        this.createDiagnostic('error', 'No JSON supplied. Paste content to lint it.')
      ];
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const sanitize = this.sanitizeJsonInput(this.jsonInput, {
      allowComments: this.allowComments,
      allowTrailingCommas: this.allowTrailingCommas
    });

    this.diagnostics = [];

    sanitize.warnings.forEach((warning) => {
      this.diagnostics.push(
        this.createDiagnostic('warning', warning)
      );
    });

    if (sanitize.transformations.length) {
      sanitize.transformations.forEach((info) => {
        this.diagnostics.push(
          this.createDiagnostic('info', info)
        );
      });
    }

    const parseSource = sanitize.text;

    try {
      const jsonValue = JSON.parse(parseSource);
      const normalized = this.prepareResult(jsonValue);
      this.resultOutput = normalized;
      this.updateResultLineNumbers();
      this.updateMetrics(this.resultOutput, this.previewLabel);
      this.conversionStatus = {
        status: 'success',
        message: 'JSON is valid and well-formed.'
      };
      this.diagnostics.unshift(
        this.createDiagnostic('info', 'JSON parsed successfully without syntax errors.')
      );
      this.recordHistory('Validated JSON');
    } catch (error) {
      const diagnostic = this.createErrorDiagnostic(error, parseSource);
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.updateMetrics(this.jsonInput, 'JSON input');
      this.conversionStatus = {
        status: 'error',
        message: `JSON Parse Error: ${diagnostic.message}. Please check your JSON syntax and try again.`
      };
      this.diagnostics.unshift(diagnostic);
    }
  }

  formatJson(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const parseResult = this.tryParseJson();
    if (!parseResult.success) {
      this.diagnostics = [parseResult.diagnostic];
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'error',
        message: `Format Error: ${parseResult.diagnostic.message}. Please fix the JSON syntax before formatting.`
      };
      return;
    }

    const normalized = this.prepareResult(parseResult.value);
    this.resultOutput = normalized;
    this.updateResultLineNumbers();
    this.updateMetrics(this.resultOutput, this.previewLabel);
    this.conversionStatus = {
      status: 'success',
      message: `JSON formatted with ${this.indentSize}-space indentation.`
    };
    this.diagnostics = [
      this.createDiagnostic('info', 'JSON formatted successfully.')
    ];
    if (this.sortKeys) {
      this.diagnostics.push(
        this.createDiagnostic('info', 'Keys sorted alphabetically during formatting.')
      );
    }
    this.recordHistory('Formatted JSON');
  }

  minifyJson(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const parseResult = this.tryParseJson();
    if (!parseResult.success) {
      this.diagnostics = [parseResult.diagnostic];
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'error',
        message: `Minify Error: ${parseResult.diagnostic.message}. Please fix the JSON syntax before minifying.`
      };
      return;
    }

    const sorted = this.sortKeys ? this.sortJsonValue(parseResult.value) : parseResult.value;
    const minified = JSON.stringify(sorted);
    this.resultOutput = minified;
    this.autoPreviewMode = 'minified';
    this.updateResultLineNumbers();
    this.updateMetrics(this.resultOutput, 'Minified JSON');
    this.conversionStatus = {
      status: 'success',
      message: 'JSON minified successfully.'
    };
    this.diagnostics = [
      this.createDiagnostic('info', 'Minified output generated (no indentation).')
    ];
    if (this.sortKeys) {
      this.diagnostics.push(
        this.createDiagnostic('info', 'Keys sorted alphabetically during minification.')
      );
    }
    this.recordHistory('Minified JSON');
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
      this.recordHistory('Copied JSON output');
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    } catch {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    }
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }
    const blob = new Blob([this.resultOutput], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `linted-json-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory('Downloaded JSON output');
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

  trackByHistory = (_index: number, entry: HistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByDiagnostic = (_index: number, diagnostic: Diagnostic): string => diagnostic.id;

  private tryParseJson(): { success: true; value: unknown } | { success: false; diagnostic: Diagnostic } {
    if (!this.jsonInput.trim().length) {
      return {
        success: false,
        diagnostic: this.createDiagnostic('error', 'Paste JSON before attempting to format or minify.')
      };
    }
    const sanitize = this.sanitizeJsonInput(this.jsonInput, {
      allowComments: this.allowComments,
      allowTrailingCommas: this.allowTrailingCommas
    });

    try {
      const parsed = JSON.parse(sanitize.text);
      return { success: true, value: parsed };
    } catch (error) {
      return {
        success: false,
        diagnostic: this.createErrorDiagnostic(error, sanitize.text)
      };
    }
  }

  private prepareResult(value: unknown): string {
    const sorted = this.sortKeys ? this.sortJsonValue(value) : value;
    if (this.autoPreviewMode === 'minified') {
      return JSON.stringify(sorted);
    }
    return JSON.stringify(sorted, null, this.indentSize);
  }

  private rebuildPreviewFromLastResult(): void {
    const parseAttempt = this.tryParseJson();
    if (!parseAttempt.success) {
      return;
    }
    const rebuilt = this.prepareResult(parseAttempt.value);
    this.resultOutput = rebuilt;
    this.updateResultLineNumbers();
    const selection = this.autoPreviewMode === 'minified' ? 'Minified JSON' : 'Formatted JSON';
    this.updateMetrics(rebuilt, selection);
  }

  private sanitizeJsonInput(
    source: string,
    options: { allowComments: boolean; allowTrailingCommas: boolean }
  ): SanitizeResult {
    const transformations = new Set<string>();
    const warnings = new Set<string>();
    let result = '';

    let inString = false;
    let stringChar = '"';
    let escaping = false;

    const length = source.length;

    for (let i = 0; i < length; i += 1) {
      const char = source[i];
      const next = i + 1 < length ? source[i + 1] : '';

      if (inString) {
        result += char;
        if (escaping) {
          escaping = false;
        } else if (char === '\\') {
          escaping = true;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      // Detect comment starts when not inside strings
      if (char === '/' && next === '/') {
        warnings.add('Single-line comments detected.');
        const endOfLine = this.findLineBreak(source, i + 2);
        if (options.allowComments) {
          transformations.add('Removed single-line comments.');
          i = endOfLine - 1;
          continue;
        }
        result += char;
        continue;
      }

      if (char === '/' && next === '*') {
        warnings.add('Block comments detected.');
        const endOfComment = this.findBlockCommentEnd(source, i + 2);
        if (options.allowComments) {
          transformations.add('Removed block comments.');
          i = endOfComment;
          continue;
        }
        result += char;
        continue;
      }

      if (char === '"' || char === '\'') {
        inString = true;
        stringChar = char;
        result += char;
        continue;
      }

      if (char === ',' && this.isTrailingComma(source, i + 1)) {
        warnings.add('Trailing commas detected.');
        if (options.allowTrailingCommas) {
          transformations.add('Removed trailing commas.');
          continue;
        }
      }

      result += char;
    }

    return {
      text: result,
      transformations: Array.from(transformations),
      warnings: Array.from(warnings)
    };
  }

  private isTrailingComma(source: string, start: number): boolean {
    for (let i = start; i < source.length; i += 1) {
      const char = source[i];
      if (/\s/.test(char)) {
        continue;
      }
      return char === '}' || char === ']';
    }
    return false;
  }

  private findLineBreak(source: string, start: number): number {
    for (let i = start; i < source.length; i += 1) {
      const char = source[i];
      if (char === '\n') {
        return i;
      }
    }
    return source.length;
  }

  private findBlockCommentEnd(source: string, start: number): number {
    for (let i = start; i < source.length - 1; i += 1) {
      if (source[i] === '*' && source[i + 1] === '/') {
        return i + 1;
      }
    }
    return source.length - 1;
  }

  private createDiagnostic(level: DiagnosticLevel, message: string, extras?: Partial<Diagnostic>): Diagnostic {
    return {
      id: this.createDiagnosticId(),
      level,
      message,
      ...extras
    };
  }

  private createErrorDiagnostic(error: unknown, source: string): Diagnostic {
    const message = error instanceof Error ? error.message : 'Unknown JSON parsing error.';
    const errorPosition = this.extractErrorPosition(error);

    if (errorPosition === null) {
      return this.createDiagnostic('error', message);
    }

    const { line, column } = this.computeLineAndColumn(source, errorPosition);
    const snippet = this.extractSnippet(source, line);

    return this.createDiagnostic('error', message, {
      line,
      column,
      snippet
    });
  }

  private extractErrorPosition(error: unknown): number | null {
    if (!(error instanceof Error)) {
      return null;
    }
    const matches = error.message.match(/position\s+(\d+)/i);
    if (matches && matches[1]) {
      return Number.parseInt(matches[1], 10);
    }
    return null;
  }

  private computeLineAndColumn(source: string, position: number): { line: number; column: number } {
    let line = 1;
    let column = 1;
    for (let i = 0; i < source.length && i < position; i += 1) {
      if (source[i] === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return { line, column };
  }

  private extractSnippet(source: string, line: number): string {
    const lines = source.split(/\r?\n/);
    if (line - 1 < 0 || line - 1 >= lines.length) {
      return '';
    }
    return lines[line - 1].trim();
  }

  private sortJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortJsonValue(item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, val]) => [key, this.sortJsonValue(val)] as [string, unknown])
        .sort((a, b) => a[0].localeCompare(b[0]));
      const sorted: Record<string, unknown> = {};
      for (const [key, val] of entries) {
        sorted[key] = val;
      }
      return sorted;
    }
    return value;
  }

  private updateMetrics(value: string, selection: string): void {
    const characters = value.length;
    const lines = value.split(/\r?\n/).length;
    const sizeLabel = this.formatBytes(new Blob([value]).size);
    this.metrics = { characters, lines, sizeLabel, selection };
  }

  private readFile(file: File): void {
    const fileName = file.name.toLowerCase();
    
    // Validate file type
    if (!fileName.endsWith('.json') && !file.type.includes('json')) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Only JSON files are supported.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.diagnostics = [
        this.createDiagnostic('error', `Unsupported file type: ${file.name}. Please upload a .json file.`)
      ];
      return;
    }

    file
      .text()
      .then((text) => {
        if (!text || !text.trim()) {
          this.conversionStatus = {
            status: 'error',
            message: `The file ${file.name} appears to be empty. Please upload a file with JSON content.`
          };
          this.resultOutput = '';
          this.updateResultLineNumbers();
          this.diagnostics = [
            this.createDiagnostic('error', `File ${file.name} is empty. Please upload a file with JSON content.`)
          ];
          return;
        }

        this.jsonInput = text;
        this.onJsonInputChange(text);
        this.conversionStatus = {
          status: 'idle',
          message: `Loaded ${file.name}. Ready to lint the content.`
        };
      })
      .catch((error) => {
        console.error('File read error', error);
        this.conversionStatus = {
          status: 'error',
          message: `Could not read the file ${file.name}. Please check file permissions and try again.`
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        this.diagnostics = [
          this.createDiagnostic('error', `File read error: Could not read ${file.name}. Please check file permissions.`)
        ];
      });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 6);
  }

  private loadSample(): void {
    this.jsonInput = SAMPLE_JSON;
    this.resultOutput = '';
    this.indentSize = this.indentOptions[0];
    this.sortKeys = false;
    this.allowComments = false;
    this.allowTrailingCommas = false;
    this.autoPreviewMode = 'formatted';
    this.diagnostics = [];
    this.copyStatus = 'idle';
    this.operationHistory = [];
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.updateMetrics(this.jsonInput, 'JSON input');
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample JSON loaded. Validate to view lint diagnostics.'
    };
  }

  private updateEditorLineNumbers(): void {
    const lines = this.jsonInput.split(/\r?\n/).length;
    this.editorLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private updateResultLineNumbers(): void {
    const lines = this.resultOutput.split(/\r?\n/).length;
    this.resultLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private createDiagnosticId(): string {
    return `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}
