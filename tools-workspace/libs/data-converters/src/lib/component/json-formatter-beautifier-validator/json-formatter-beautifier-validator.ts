import { Component, HostListener, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import { dcDownloadBlob, dcDownloadTimestamp } from '../../shared/dc-download.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  JSON_FORMATTER_CALLOUTS,
  JSON_FORMATTER_DEFAULT_SAMPLE,
  JSON_FORMATTER_HISTORY_LIMIT,
  JSON_FORMATTER_INDENTATION_OPTIONS,
  JSON_FORMATTER_KEYBOARD_SHORTCUTS_TOOLTIP,
  JSON_FORMATTER_RELATED_TOOLS,
  JSON_FORMATTER_RESULT_TABS,
  JSON_FORMATTER_TIPS,
  JSON_FORMATTER_USAGE_STEPS
} from '../../constants/json-formatter-beautifier-validator.constants';
import type {
  JsonFormatterFormatMode,
  JsonFormatterHistoryEntry,
  JsonFormatterIndentStyle,
  JsonFormatterInputMetrics,
  JsonFormatterResultTab,
  JsonFormatterValidationResult,
  JsonTreeNode
} from '../../types/json-formatter-beautifier-validator.types';
import {
  buildJsonLineNumberList,
  computeJsonInputMetrics,
  createJsonFormatterDefaultSampleText,
  generateJsonTreeNodes,
  resolveJsonFormatterSuggestion,
  resolveJsonStringifyIndent,
  safeParseJson,
  tryAutoFixJsonSource
} from '../../utils/json-formatter-beautifier-validator.utils';

@Component({
  selector: 'lib-json-formatter-beautifier-validator',
  standalone: true,
  templateUrl: './json-formatter-beautifier-validator.html',
  styleUrls: ['./json-formatter-beautifier-validator.scss'],
  imports: [
    DecimalPipe,
    NgFor,
    NgIf,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    Navigation,
    TooltipDirective
  ]
})
export class JsonFormatterBeautifierValidatorComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('editorTextarea') editorTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;
  @ViewChild('outputLineNumbers') outputLineNumbers!: ElementRef<HTMLElement>;

  private fileInput: HTMLInputElement | null = null;
  private dismissedSuggestionId: string | null = null;

  readonly resultTabs = JSON_FORMATTER_RESULT_TABS;
  readonly indentationOptions = [...JSON_FORMATTER_INDENTATION_OPTIONS];
  readonly formatterTips = JSON_FORMATTER_TIPS;
  readonly usageSteps = JSON_FORMATTER_USAGE_STEPS;
  readonly callouts = JSON_FORMATTER_CALLOUTS;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = JSON_FORMATTER_RELATED_TOOLS;

  activeResultTab: JsonFormatterResultTab = 'formatted';
  rawInput = '';
  formattedOutput = '';
  /** Allows HTML select values including 8 (beyond the listed presets). */
  indentSize: number = this.indentationOptions[0];
  indentStyle: JsonFormatterIndentStyle = 'spaces';
  autoValidate = true;

  validationResult: JsonFormatterValidationResult | null = null;
  operationHistory: JsonFormatterHistoryEntry[] = [];
  inputMetrics: JsonFormatterInputMetrics = { characters: 0, lines: 0, sizeLabel: '0 B' };
  treeNodes: JsonTreeNode[] = [];
  copyStatus: 'idle' | 'success' | 'error' = 'idle';
  lastFormatMode: JsonFormatterFormatMode | null = null;
  isDragOver = false;
  editorLines: number[] = [];
  formattedLines: number[] = [];

  constructor() {
    this.loadSamplePayload();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.setupKeyboardShortcuts();
  }

  get formattedOutputAvailable(): boolean {
    return this.formattedOutput.trim().length > 0;
  }

  get indentLabel(): string {
    if (this.indentStyle === 'tabs') {
      return 'Tabs';
    }
    return `${this.indentSize} spaces`;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveJsonFormatterSuggestion({
      source: this.rawInput,
      hasOutput: this.formattedOutputAvailable,
      validationStatus: this.validationResult?.status ?? null
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
  }

  onIndentSizeChange(size: number): void {
    this.indentSize = size;
    this.autoFormatWhenPossible();
  }

  onIndentStyleChange(style: JsonFormatterIndentStyle): void {
    this.indentStyle = style;
    this.autoFormatWhenPossible();
  }

  onRawInputChange(value: string): void {
    this.rawInput = value;
    this.dismissedSuggestionId = null;
    this.updateInputMetrics(value);
    this.updateEditorLineNumbers();
    if (this.autoValidate) {
      this.validateJson(false, false);
    } else {
      this.validationResult = null;
    }
  }

  toggleAutoValidate(): void {
    this.autoValidate = !this.autoValidate;
    if (this.autoValidate) {
      this.validateJson(false, false);
    }
  }

  setActiveResultTab(tab: JsonFormatterResultTab): void {
    this.activeResultTab = tab;
  }

  formatJson(): void {
    const indent = resolveJsonStringifyIndent(this.indentSize, this.indentStyle);
    const parseResult = safeParseJson(this.rawInput);
    if (!parseResult.success) {
      this.validationResult = parseResult.error;
      this.activeResultTab = 'validation';
      this.lastFormatMode = null;
      return;
    }

    this.formattedOutput = JSON.stringify(parseResult.value, null, indent);
    this.updateFormattedLineNumbers();
    this.validationResult = {
      status: 'success',
      message: `Beautified JSON with ${this.indentLabel.toLowerCase()}.`
    };
    this.activeResultTab = 'formatted';
    this.lastFormatMode = 'beautify';
    this.recordHistory('Beautified JSON');
    this.updateTree(parseResult.value);
  }

  minifyJson(): void {
    const parseResult = safeParseJson(this.rawInput);
    if (!parseResult.success) {
      this.validationResult = parseResult.error;
      this.activeResultTab = 'validation';
      this.lastFormatMode = null;
      return;
    }

    this.formattedOutput = JSON.stringify(parseResult.value);
    this.updateFormattedLineNumbers();
    this.validationResult = {
      status: 'success',
      message: 'Minified JSON payload.'
    };
    this.activeResultTab = 'formatted';
    this.lastFormatMode = 'minify';
    this.recordHistory('Minified JSON');
    this.updateTree(parseResult.value);
  }

  autoFixJson(): void {
    try {
      const fixResult = tryAutoFixJsonSource(this.rawInput);
      if (fixResult.ok) {
        this.rawInput = JSON.stringify(fixResult.value, null, this.indentSize);
        this.onRawInputChange(this.rawInput);
        this.formatJson();
        this.recordHistory('Auto-fixed JSON');
        this.validationResult = {
          status: 'success',
          message: 'JSON auto-fixed and formatted successfully.'
        };
      } else {
        this.validationResult = {
          status: 'error',
          message: 'Could not auto-fix JSON. Please fix errors manually.'
        };
        this.activeResultTab = 'validation';
      }
    } catch {
      this.validationResult = {
        status: 'error',
        message: 'Auto-fix failed. Please fix errors manually.'
      };
      this.activeResultTab = 'validation';
    }
  }

  runAll(): void {
    this.validateJson(true, false);
    this.formatJson();
    this.activeResultTab = 'formatted';
    this.recordHistory('Ran all operations');
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
    void this.copyText(this.rawInput, 'Input');
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

  validateJson(updateTree = true, setActiveTab = true): void {
    const parseResult = safeParseJson(this.rawInput);
    if (!parseResult.success) {
      this.validationResult = parseResult.error;
      this.activeResultTab = 'validation';
      if (updateTree) {
        this.treeNodes = [];
      }
      return;
    }

    this.validationResult = {
      status: 'success',
      message: 'JSON is syntactically valid.'
    };
    if (setActiveTab) {
      this.activeResultTab = 'validation';
    }
    if (updateTree) {
      this.updateTree(parseResult.value);
    }
    this.recordHistory('Validated JSON');
  }

  resetWorkspace(): void {
    this.loadSamplePayload();
  }

  async copyFormatted(): Promise<void> {
    if (!this.formattedOutputAvailable) {
      this.copyStatus = 'error';
      return;
    }

    const ok = await dcCopyText(this.toast, this.formattedOutput, 'Formatted JSON');
    if (ok) {
      this.copyStatus = 'success';
      this.recordHistory('Copied formatted JSON');
    } else {
      this.copyStatus = 'error';
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1600);
  }

  downloadFormatted(): void {
    if (!this.formattedOutputAvailable) {
      return;
    }
    try {
      const blob = new Blob([this.formattedOutput], { type: 'application/json' });
      dcDownloadBlob(blob, `formatted-json-${dcDownloadTimestamp()}.json`);
      this.recordHistory('Downloaded formatted JSON');
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

  trackByNodeId(_: number, node: JsonTreeNode): string {
    return node.id;
  }

  toggleNode(node: JsonTreeNode): void {
    node.expanded = !node.expanded;
  }

  getKeyboardShortcutsTooltip(): string {
    return JSON_FORMATTER_KEYBOARD_SHORTCUTS_TOOLTIP;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      if (
        target.tagName === 'TEXTAREA' &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        if (this.formattedOutputAvailable) {
          this.downloadFormatted();
        }
        return;
      }
      return;
    }

    const ctrlOrCmd = event.ctrlKey || event.metaKey;

    if (ctrlOrCmd) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          this.formatJson();
          break;
        case 'm':
          event.preventDefault();
          this.minifyJson();
          break;
        case 'v':
          event.preventDefault();
          this.validateJson();
          break;
        case 'f':
          event.preventDefault();
          this.autoFixJson();
          break;
        case 'c':
          if (this.formattedOutputAvailable) {
            event.preventDefault();
            void this.copyFormatted();
          }
          break;
        case 's':
          if (this.formattedOutputAvailable) {
            event.preventDefault();
            this.downloadFormatted();
          }
          break;
      }
    }
  }

  private async copyText(text: string, label: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    await dcCopyText(this.toast, text, label);
  }

  private loadSamplePayload(): void {
    this.rawInput = createJsonFormatterDefaultSampleText(JSON_FORMATTER_DEFAULT_SAMPLE);
    this.formattedOutput = this.rawInput;
    this.dismissedSuggestionId = null;
    this.updateInputMetrics(this.rawInput);
    this.updateEditorLineNumbers();
    this.updateFormattedLineNumbers();
    this.validationResult = {
      status: 'success',
      message: 'Sample JSON loaded. Ready for formatting or validation.'
    };
    this.updateTree(JSON_FORMATTER_DEFAULT_SAMPLE);
    this.operationHistory = [];
    this.copyStatus = 'idle';
    this.lastFormatMode = 'beautify';
    this.activeResultTab = 'formatted';
  }

  private updateInputMetrics(value: string): void {
    this.inputMetrics = computeJsonInputMetrics(value);
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(
      0,
      JSON_FORMATTER_HISTORY_LIMIT
    );
  }

  private autoFormatWhenPossible(): void {
    if (this.lastFormatMode === 'beautify') {
      this.formatJson();
    } else if (this.lastFormatMode === 'minify') {
      this.minifyJson();
    }
  }

  private readFile(file: File): void {
    file
      .text()
      .then((text) => {
        this.rawInput = text;
        this.formattedOutput = '';
        this.onRawInputChange(text);
        this.updateEditorLineNumbers();
        this.validationResult = null;
        this.lastFormatMode = null;
        this.toast.info(`Loaded ${file.name}`);
      })
      .catch(() => {
        this.validationResult = {
          status: 'error',
          message: 'Could not read the selected file. Please try another JSON file.'
        };
        this.toast.error('Could not read file');
      });
  }

  private updateTree(value: unknown): void {
    this.treeNodes = generateJsonTreeNodes(value, 0);
  }

  private updateEditorLineNumbers(): void {
    this.editorLines = buildJsonLineNumberList(this.rawInput);
  }

  private updateFormattedLineNumbers(): void {
    this.formattedLines = buildJsonLineNumberList(this.formattedOutput);
  }

  private setupKeyboardShortcuts(): void {
    // Keyboard shortcuts are handled via HostListener
  }
}
