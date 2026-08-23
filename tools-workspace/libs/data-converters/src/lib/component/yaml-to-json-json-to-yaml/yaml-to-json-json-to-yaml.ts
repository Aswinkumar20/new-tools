import { Component, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  YAML_JSON_CALLOUTS,
  YAML_JSON_HISTORY_LIMIT,
  YAML_JSON_MODES,
  YAML_JSON_RELATED_TOOLS,
  YAML_JSON_SAMPLE_JSON,
  YAML_JSON_SAMPLE_YAML,
  YAML_JSON_USAGE_STEPS
} from '../../constants/yaml-to-json-json-to-yaml.constants';
import type {
  YamlJsonConversionMode,
  YamlJsonConversionStatus,
  YamlJsonCopyStatus,
  YamlJsonHistoryEntry,
  YamlJsonMetricsSummary
} from '../../types/yaml-to-json-json-to-yaml.types';
import {
  blurActiveElement,
  buildYamlJsonLineNumbers,
  computeYamlJsonMetrics,
  parseYamlDocument,
  resolveYamlJsonSuggestion,
  sortYamlJsonValue,
  stringifyToYaml
} from '../../utils/yaml-to-json-json-to-yaml.utils';

@Component({
  selector: 'lib-yaml-to-json-json-to-yaml',
  standalone: true,
  templateUrl: './yaml-to-json-json-to-yaml.html',
  styleUrls: ['./yaml-to-json-json-to-yaml.scss'],
  imports: [DecimalPipe, NgIf, NgFor, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class YamlToJsonJsonToYamlComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('yamlTextarea') yamlTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;
  private dismissedSuggestionId: string | null = null;

  readonly modes = YAML_JSON_MODES;
  readonly usageSteps = YAML_JSON_USAGE_STEPS;
  readonly callouts = YAML_JSON_CALLOUTS;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = YAML_JSON_RELATED_TOOLS;

  conversionMode: YamlJsonConversionMode = 'yaml-to-json';

  yamlInput = '';
  jsonInput = '';
  resultOutput = '';

  yamlIndent = 2;
  yamlSortKeys = false;
  yamlQuoteStrings = true;

  jsonPrettyPrint = true;
  jsonSortKeys = false;

  conversionStatus: YamlJsonConversionStatus = {
    status: 'idle',
    message: 'Load a sample or paste your data.'
  };
  metrics: YamlJsonMetricsSummary = { lines: 0, sizeLabel: '0 B', selection: 'YAML' };
  operationHistory: YamlJsonHistoryEntry[] = [];

  copyStatus: YamlJsonCopyStatus = 'idle';
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

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveYamlJsonSuggestion({
      mode: this.conversionMode,
      yamlInput: this.yamlInput,
      jsonInput: this.jsonInput,
      hasOutput: !!this.resultOutput.trim(),
      status: this.conversionStatus.status
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  isModeSwitchSuggestion(suggestion: DcToolSuggestion): boolean {
    return suggestion.id === 'yj-switch-json' || suggestion.id === 'yj-switch-yaml';
  }

  applySuggestion(suggestion: DcToolSuggestion): void {
    if (suggestion.id === 'yj-switch-json') {
      this.jsonInput = this.yamlInput;
      this.conversionMode = 'json-to-yaml';
      this.resultOutput = '';
      this.dismissedSuggestionId = suggestion.id;
      this.updateMetrics(this.jsonInput, 'JSON');
      this.updateEditorLineNumbers();
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'idle',
        message: 'Switched to JSON → YAML. Convert when ready.'
      };
      return;
    }
    if (suggestion.id === 'yj-switch-yaml') {
      this.yamlInput = this.jsonInput;
      this.conversionMode = 'yaml-to-json';
      this.resultOutput = '';
      this.dismissedSuggestionId = suggestion.id;
      this.updateMetrics(this.yamlInput, 'YAML');
      this.updateEditorLineNumbers();
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'idle',
        message: 'Switched to YAML → JSON. Convert when ready.'
      };
    }
  }

  onModeChange(mode: YamlJsonConversionMode): void {
    if (this.conversionMode === mode) {
      return;
    }

    blurActiveElement();

    this.conversionMode = mode;
    this.yamlInput = '';
    this.jsonInput = '';
    this.resultOutput = '';
    this.dismissedSuggestionId = null;

    this.metrics = {
      lines: 0,
      sizeLabel: '0 B',
      selection: mode === 'yaml-to-json' ? 'YAML' : 'JSON'
    };

    this.operationHistory = [];
    this.copyStatus = 'idle';
    this.loadSample();
  }

  onYamlInputChange(value: string): void {
    this.yamlInput = value;
    this.dismissedSuggestionId = null;
    this.updateMetrics(value, 'YAML');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'yaml-to-json') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert YAML into JSON.' };
    }
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
    this.dismissedSuggestionId = null;
    this.updateMetrics(value, 'JSON');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'json-to-yaml') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert JSON into YAML.' };
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
    const text = this.conversionMode === 'yaml-to-json' ? this.yamlInput : this.jsonInput;
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
      this.conversionMode === 'yaml-to-json' ? '.yml,.yaml' : '.json,application/json';
    this.fileInput.click();
  }

  toggleYamlSortKeys(): void {
    this.yamlSortKeys = !this.yamlSortKeys;
  }

  toggleYamlQuoteStrings(): void {
    this.yamlQuoteStrings = !this.yamlQuoteStrings;
  }

  onYamlIndentChange(value: number): void {
    this.yamlIndent = value;
  }

  toggleJsonPrettyPrint(): void {
    this.jsonPrettyPrint = !this.jsonPrettyPrint;
  }

  toggleJsonSortKeys(): void {
    this.jsonSortKeys = !this.jsonSortKeys;
  }

  convert(): void {
    blurActiveElement();
    this.conversionStatus = { status: 'idle', message: 'Converting…' };
    if (this.conversionMode === 'yaml-to-json') {
      this.convertYamlToJson();
    } else {
      this.convertJsonToYaml();
    }
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

    const label = this.conversionMode === 'yaml-to-json' ? 'JSON' : 'YAML';
    const ok = await dcCopyText(this.toast, this.resultOutput, `${label} result`);
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
    const extension = this.conversionMode === 'yaml-to-json' ? 'json' : 'yml';
    const type = extension === 'json' ? 'application/json' : 'text/yaml';
    try {
      const blob = new Blob([this.resultOutput], { type: `${type};charset=utf-8` });
      dcDownloadBlob(blob, `converted-${dcDownloadTimestamp()}.${extension}`);
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

  trackByHistory(_: number, entry: YamlJsonHistoryEntry): string {
    return `${entry.label}-${entry.timestamp}`;
  }

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private convertYamlToJson(): void {
    if (!this.yamlInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste or upload YAML content to convert it into JSON. The input field is empty.'
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    try {
      const parsed = parseYamlDocument(this.yamlInput);
      const sorted = this.jsonSortKeys ? sortYamlJsonValue(parsed) : parsed;
      this.resultOutput = JSON.stringify(sorted, null, this.jsonPrettyPrint ? 2 : undefined);
      this.updateResultLineNumbers();
      this.metrics = computeYamlJsonMetrics(this.resultOutput, 'JSON');
      this.conversionStatus = {
        status: 'success',
        message: 'Converted YAML to JSON.'
      };
      this.recordHistory('Converted YAML to JSON');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to parse YAML. Check indentation or syntax.';
      this.conversionStatus = {
        status: 'error',
        message: `YAML Parse Error: ${errorMessage}. Please check your YAML syntax, indentation, and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private convertJsonToYaml(): void {
    if (!this.jsonInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste or upload JSON content to convert it into YAML. The input field is empty.'
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

    if (this.yamlSortKeys) {
      parsed = sortYamlJsonValue(parsed);
    }

    try {
      this.resultOutput = stringifyToYaml(parsed, 0, {
        indent: this.yamlIndent,
        quoteStrings: this.yamlQuoteStrings
      });
      this.updateResultLineNumbers();
      this.metrics = computeYamlJsonMetrics(this.resultOutput, 'YAML');
      this.conversionStatus = {
        status: 'success',
        message: 'Converted JSON to YAML.'
      };
      this.recordHistory('Converted JSON to YAML');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unable to serialize JSON into YAML.';
      this.conversionStatus = {
        status: 'error',
        message: `YAML Generation Error: ${errorMessage}. Please ensure your JSON structure is valid.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private updateMetrics(value: string, selection: string): void {
    this.metrics = computeYamlJsonMetrics(value, selection);
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(
      0,
      YAML_JSON_HISTORY_LIMIT
    );
  }

  private readFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isYaml = extension === 'yaml' || extension === 'yml';
    const isJson = extension === 'json';

    file
      .text()
      .then((text) => {
        if (isYaml || (!isJson && this.conversionMode === 'yaml-to-json')) {
          this.conversionMode = 'yaml-to-json';
          this.yamlInput = text;
          this.dismissedSuggestionId = null;
          this.updateMetrics(text, 'YAML');
          this.updateEditorLineNumbers();
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded YAML file (${file.name}). Ready to convert.`
          };
          this.toast.info(`Loaded ${file.name}`);
        } else if (isJson || (!isYaml && this.conversionMode === 'json-to-yaml')) {
          this.conversionMode = 'json-to-yaml';
          this.jsonInput = text;
          this.dismissedSuggestionId = null;
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
            message: `Unsupported file type: ${extension || 'unknown'}. Upload YAML or JSON.`
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
    this.dismissedSuggestionId = null;
    if (this.conversionMode === 'yaml-to-json') {
      this.yamlInput = YAML_JSON_SAMPLE_YAML;
      this.jsonInput = '';
      this.resultOutput = '';
      this.updateMetrics(this.yamlInput, 'YAML');
      this.updateEditorLineNumbers();
      this.updateResultLineNumbers();
      this.conversionStatus = {
        status: 'idle',
        message: 'Sample YAML loaded. Adjust options and convert when ready.'
      };
    } else {
      this.jsonInput = YAML_JSON_SAMPLE_JSON;
      this.yamlInput = '';
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
    const currentInput = this.conversionMode === 'yaml-to-json' ? this.yamlInput : this.jsonInput;
    this.editorLines = buildYamlJsonLineNumbers(currentInput);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildYamlJsonLineNumbers(this.resultOutput);
  }
}
