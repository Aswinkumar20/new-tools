import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { DecimalPipe, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  HTML_TABLE_TO_JSON_CALLOUTS,
  HTML_TABLE_TO_JSON_HISTORY_LIMIT,
  HTML_TABLE_TO_JSON_RELATED_TOOLS,
  HTML_TABLE_TO_JSON_SAMPLE,
  HTML_TABLE_TO_JSON_SELECTION_MODES,
  HTML_TABLE_TO_JSON_USAGE_STEPS
} from '../../constants/html-table-to-json.constants';
import type {
  HtmlTableConversionStatus,
  HtmlTableHistoryEntry,
  HtmlTableMetricsSummary,
  HtmlTableSelectionMode
} from '../../types/html-table-to-json.types';
import {
  blurActiveElement,
  buildLineNumberList,
  convertHtmlTableToJson,
  formatHtmlTableBytes,
  prependHtmlTableHistory,
  resolveHtmlTableToJsonSuggestion
} from '../../utils/html-table-to-json.utils';

@Component({
  selector: 'lib-html-table-to-json',
  standalone: true,
  templateUrl: './html-table-to-json.html',
  styleUrls: ['./html-table-to-json.scss'],
  imports: [NgFor, DecimalPipe, FormsModule, RouterLink, Navigation, TooltipDirective]
})
export class HtmlTableToJsonComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;

  readonly selectionModes = HTML_TABLE_TO_JSON_SELECTION_MODES;
  readonly usageSteps = HTML_TABLE_TO_JSON_USAGE_STEPS;
  readonly callouts = HTML_TABLE_TO_JSON_CALLOUTS;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = HTML_TABLE_TO_JSON_RELATED_TOOLS;

  selectionMode: HtmlTableSelectionMode = 'auto';
  customSelector = '';
  headerRows = 1;
  includeEmptyCells = true;
  trimCells = true;
  compactArrays = false;
  detectNumbers = true;
  detectDates = false;

  htmlInput = '';
  resultOutput = '';

  conversionStatus: HtmlTableConversionStatus = {
    status: 'idle',
    message: 'Load a sample table or paste HTML to begin.'
  };
  metrics: HtmlTableMetricsSummary = { rows: 0, columns: 0, sizeLabel: '0 B' };
  operationHistory: HtmlTableHistoryEntry[] = [];

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

  get selectionDescription(): string | undefined {
    return this.selectionModes.find((mode) => mode.id === this.selectionMode)?.description;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveHtmlTableToJsonSuggestion(
      this.htmlInput,
      !!this.resultOutput.trim(),
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

  onSelectionModeChange(mode: HtmlTableSelectionMode): void {
    if (this.selectionMode === mode) {
      return;
    }

    blurActiveElement();
    this.selectionMode = mode;

    if (mode !== 'custom') {
      this.customSelector = '';
    }

    this.resultOutput = '';
    this.updateResultLineNumbers();
    this.conversionStatus = {
      status: 'idle',
      message: 'Mode changed. Ready to convert HTML table into JSON.'
    };
  }

  onHtmlInputChange(value: string): void {
    this.htmlInput = value;
    this.resultOutput = '';
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.metrics = {
      rows: 0,
      columns: 0,
      sizeLabel: formatHtmlTableBytes(new Blob([value]).size)
    };
    this.conversionStatus = { status: 'idle', message: 'Ready to convert HTML table into JSON.' };
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
    void this.copyText(this.htmlInput, 'Input');
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
    this.fileInput.accept = '.html,text/html';
    this.fileInput.click();
  }

  toggleCompactArrays(): void {
    this.compactArrays = !this.compactArrays;
  }

  toggleTrimCells(): void {
    this.trimCells = !this.trimCells;
  }

  toggleIncludeEmptyCells(): void {
    this.includeEmptyCells = !this.includeEmptyCells;
  }

  toggleDetectNumbers(): void {
    this.detectNumbers = !this.detectNumbers;
  }

  toggleDetectDates(): void {
    this.detectDates = !this.detectDates;
  }

  convert(): void {
    blurActiveElement();

    const outcome = convertHtmlTableToJson(
      this.htmlInput,
      this.selectionMode,
      this.customSelector,
      this.headerRows,
      this.trimCells,
      this.compactArrays,
      this.includeEmptyCells,
      this.detectDates,
      this.detectNumbers
    );

    if (!outcome.ok) {
      this.conversionStatus = { status: 'error', message: outcome.message };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    this.resultOutput = outcome.output;
    this.updateResultLineNumbers();
    this.metrics = outcome.metrics;
    this.conversionStatus = { status: 'success', message: outcome.message };
    this.recordHistory('Converted HTML table to JSON');
    this.toast.success('Table converted to JSON');
  }

  resetWorkspace(): void {
    blurActiveElement();
    this.loadSample();
    this.toast.info('Sample table loaded');
  }

  async copyResult(): Promise<void> {
    if (!this.resultOutput.trim()) {
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
      return;
    }

    const ok = await dcCopyText(this.toast, this.resultOutput, 'Output');
    this.copyStatus = ok ? 'success' : 'error';
    if (ok) {
      this.recordHistory('Copied JSON result');
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  downloadResult(): void {
    if (!this.resultOutput.trim()) {
      return;
    }

    try {
      dcDownloadBlob(
        new Blob([this.resultOutput], { type: 'application/json;charset=utf-8' }),
        `table-${dcDownloadTimestamp()}.json`
      );
      this.recordHistory('Downloaded JSON result');
      this.toast.success('JSON downloaded');
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

  trackByHistory(_: number, entry: HtmlTableHistoryEntry): string {
    return `${entry.label}-${entry.timestamp}`;
  }

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private readFile(file: File): void {
    if (!file.type.includes('html') && !file.name.toLowerCase().endsWith('.html')) {
      this.conversionStatus = {
        status: 'error',
        message: `Unsupported file type: ${file.name.split('.').pop() || 'unknown'}. Only HTML files are supported for table conversion.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
      this.toast.error('Unsupported file type');
      return;
    }

    file
      .text()
      .then((text) => {
        this.htmlInput = text;
        this.updateEditorLineNumbers();
        this.updateResultLineNumbers();
        this.conversionStatus = {
          status: 'idle',
          message: `Loaded HTML file (${file.name}). Configure options and convert when ready.`
        };
        this.metrics = {
          rows: 0,
          columns: 0,
          sizeLabel: formatHtmlTableBytes(text.length)
        };
        this.toast.info(`Loaded ${file.name}`);
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message:
            'Could not read the selected file. Please try another HTML file or check file permissions.'
        };
        this.resultOutput = '';
        this.updateResultLineNumbers();
        this.toast.error('Could not read file');
      });
  }

  private recordHistory(label: string): void {
    this.operationHistory = prependHtmlTableHistory(
      this.operationHistory,
      label,
      HTML_TABLE_TO_JSON_HISTORY_LIMIT
    );
  }

  private loadSample(): void {
    this.htmlInput = HTML_TABLE_TO_JSON_SAMPLE;
    this.resultOutput = '';
    this.customSelector = '';
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
    this.metrics = {
      rows: 0,
      columns: 0,
      sizeLabel: formatHtmlTableBytes(this.htmlInput.length)
    };
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample HTML table loaded. Adjust options and convert when ready.'
    };
    this.operationHistory = [];
    this.copyStatus = 'idle';
  }

  private updateEditorLineNumbers(): void {
    this.editorLines = buildLineNumberList(this.htmlInput);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildLineNumberList(this.resultOutput);
  }
}
