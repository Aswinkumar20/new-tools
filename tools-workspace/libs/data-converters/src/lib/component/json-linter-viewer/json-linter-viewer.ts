import { Component, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DecimalPipe, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  JSON_LINTER_HERO_HIGHLIGHTS,
  JSON_LINTER_HISTORY_LIMIT,
  JSON_LINTER_INDENT_OPTIONS,
  JSON_LINTER_RELATED_TOOLS,
  JSON_LINTER_SAMPLE_JSON
} from '../../constants/json-linter-viewer.constants';
import type {
  JsonLinterConversionStatus,
  JsonLinterCopyStatus,
  JsonLinterDiagnostic,
  JsonLinterHistoryEntry,
  JsonLinterMetricsSummary,
  JsonLinterPreviewMode
} from '../../types/json-linter-viewer.types';
import {
  blurActiveElement,
  buildJsonLinterLineNumbers,
  computeJsonLinterMetrics,
  createJsonLinterDiagnostic,
  createJsonLinterErrorDiagnostic,
  isSupportedJsonLinterFile,
  prepareJsonLinterResult,
  resolveJsonLinterSuggestion,
  sanitizeJsonLinterInput,
  sortJsonLinterValue,
  tryParseJsonLinterInput
} from '../../utils/json-linter-viewer.utils';

@Component({
  selector: 'lib-json-linter-viewer',
  standalone: true,
  templateUrl: './json-linter-viewer.html',
  styleUrls: ['./json-linter-viewer.scss'],
  imports: [DecimalPipe, NgFor, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class JsonLinterViewerComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;
  private dismissedSuggestionId: string | null = null;

  readonly indentOptions = [...JSON_LINTER_INDENT_OPTIONS];
  readonly sampleJson = JSON_LINTER_SAMPLE_JSON;
  readonly heroHighlights = JSON_LINTER_HERO_HIGHLIGHTS;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = JSON_LINTER_RELATED_TOOLS;

  jsonInput = '';
  resultOutput = '';

  indentSize: number = this.indentOptions[0];
  sortKeys = false;
  allowComments = false;
  allowTrailingCommas = false;
  autoPreviewMode: JsonLinterPreviewMode = 'formatted';

  diagnostics: JsonLinterDiagnostic[] = [];
  operationHistory: JsonLinterHistoryEntry[] = [];

  conversionStatus: JsonLinterConversionStatus = {
    status: 'idle',
    message: 'Load the sample or paste JSON to begin linting.'
  };

  metrics: JsonLinterMetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B',
    selection: 'JSON input'
  };

  copyStatus: JsonLinterCopyStatus = 'idle';
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

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveJsonLinterSuggestion({
      source: this.jsonInput,
      hasOutput: !!this.resultOutput.trim(),
      lintStatus: this.conversionStatus.status,
      allowComments: this.allowComments,
      allowTrailingCommas: this.allowTrailingCommas
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
    this.dismissedSuggestionId = null;
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
    void this.copyText(this.jsonInput, 'Input');
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

  setPreviewMode(mode: JsonLinterPreviewMode): void {
    this.autoPreviewMode = mode;
    if (this.resultOutput) {
      this.rebuildPreviewFromLastResult();
    }
    blurActiveElement();
  }

  validateJson(): void {
    blurActiveElement();

    if (!this.jsonInput.trim().length) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste JSON or load the sample before validating. The input field is empty.'
      };
      this.diagnostics = [
        createJsonLinterDiagnostic('error', 'No JSON supplied. Paste content to lint it.')
      ];
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    const sanitize = sanitizeJsonLinterInput(this.jsonInput, {
      allowComments: this.allowComments,
      allowTrailingCommas: this.allowTrailingCommas
    });

    this.diagnostics = [];

    sanitize.warnings.forEach((warning) => {
      this.diagnostics.push(createJsonLinterDiagnostic('warning', warning));
    });

    if (sanitize.transformations.length) {
      sanitize.transformations.forEach((info) => {
        this.diagnostics.push(createJsonLinterDiagnostic('info', info));
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
        createJsonLinterDiagnostic('info', 'JSON parsed successfully without syntax errors.')
      );
      this.recordHistory('Validated JSON');
    } catch (error) {
      const diagnostic = createJsonLinterErrorDiagnostic(error, parseSource);
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
    blurActiveElement();

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
    this.diagnostics = [createJsonLinterDiagnostic('info', 'JSON formatted successfully.')];
    if (this.sortKeys) {
      this.diagnostics.push(
        createJsonLinterDiagnostic('info', 'Keys sorted alphabetically during formatting.')
      );
    }
    this.recordHistory('Formatted JSON');
  }

  minifyJson(): void {
    blurActiveElement();

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

    const sorted = this.sortKeys ? sortJsonLinterValue(parseResult.value) : parseResult.value;
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
      createJsonLinterDiagnostic('info', 'Minified output generated (no indentation).')
    ];
    if (this.sortKeys) {
      this.diagnostics.push(
        createJsonLinterDiagnostic('info', 'Keys sorted alphabetically during minification.')
      );
    }
    this.recordHistory('Minified JSON');
  }

  resetWorkspace(): void {
    blurActiveElement();
    this.loadSample();
  }

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    const ok = await dcCopyText(this.toast, this.resultOutput, 'JSON output');
    if (ok) {
      this.copyStatus = 'success';
      this.recordHistory('Copied JSON output');
    } else {
      this.copyStatus = 'error';
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }
    try {
      const blob = new Blob([this.resultOutput], { type: 'application/json;charset=utf-8' });
      dcDownloadBlob(blob, `linted-json-${dcDownloadTimestamp()}.json`);
      this.recordHistory('Downloaded JSON output');
      this.toast.success('JSON downloaded');
    } catch {
      this.toast.error('Could not download JSON');
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

  trackByHistory = (_index: number, entry: JsonLinterHistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByDiagnostic = (_index: number, diagnostic: JsonLinterDiagnostic): string => diagnostic.id;

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private tryParseJson() {
    return tryParseJsonLinterInput(this.jsonInput, {
      allowComments: this.allowComments,
      allowTrailingCommas: this.allowTrailingCommas
    });
  }

  private prepareResult(value: unknown): string {
    return prepareJsonLinterResult(value, {
      sortKeys: this.sortKeys,
      previewMode: this.autoPreviewMode,
      indentSize: this.indentSize
    });
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

  private updateMetrics(value: string, selection: string): void {
    this.metrics = computeJsonLinterMetrics(value, selection);
  }

  private readFile(file: File): void {
    if (!isSupportedJsonLinterFile(file)) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Only JSON files are supported.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.diagnostics = [
        createJsonLinterDiagnostic(
          'error',
          `Unsupported file type: ${file.name}. Please upload a .json file.`
        )
      ];
      this.toast.error('Unsupported file type');
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
            createJsonLinterDiagnostic(
              'error',
              `File ${file.name} is empty. Please upload a file with JSON content.`
            )
          ];
          this.toast.error('File is empty');
          return;
        }

        this.jsonInput = text;
        this.onJsonInputChange(text);
        this.conversionStatus = {
          status: 'idle',
          message: `Loaded ${file.name}. Ready to lint the content.`
        };
        this.toast.info(`Loaded ${file.name}`);
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: `Could not read the file ${file.name}. Please check file permissions and try again.`
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        this.diagnostics = [
          createJsonLinterDiagnostic(
            'error',
            `File read error: Could not read ${file.name}. Please check file permissions.`
          )
        ];
        this.toast.error('Could not read file');
      });
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(
      0,
      JSON_LINTER_HISTORY_LIMIT
    );
  }

  private loadSample(): void {
    this.jsonInput = JSON_LINTER_SAMPLE_JSON;
    this.resultOutput = '';
    this.indentSize = this.indentOptions[0];
    this.sortKeys = false;
    this.allowComments = false;
    this.allowTrailingCommas = false;
    this.autoPreviewMode = 'formatted';
    this.diagnostics = [];
    this.copyStatus = 'idle';
    this.operationHistory = [];
    this.dismissedSuggestionId = null;
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.updateMetrics(this.jsonInput, 'JSON input');
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample JSON loaded. Validate to view lint diagnostics.'
    };
  }

  private updateEditorLineNumbers(): void {
    this.editorLines = buildJsonLinterLineNumbers(this.jsonInput);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildJsonLinterLineNumbers(this.resultOutput);
  }
}
