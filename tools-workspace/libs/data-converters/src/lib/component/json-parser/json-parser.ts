import { Component, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import { dcCopyText } from '../../shared/dc-clipboard.util';
import type { DcRelatedToolLink, DcToolSuggestion } from '../../shared/dc-tool-suggestion.model';
import {
  JSON_PARSER_HERO_HIGHLIGHTS,
  JSON_PARSER_HISTORY_LIMIT,
  JSON_PARSER_PREVIEW_MODES,
  JSON_PARSER_RELATED_TOOLS,
  JSON_PARSER_SAMPLE_JSON,
  JSON_PARSER_STRING_LITERAL_PLACEHOLDER,
  JSON_PARSER_STRINGIFY_PLACEHOLDER
} from '../../constants/json-parser.constants';
import type {
  JsonParserCopyStatus,
  JsonParserDiagnostic,
  JsonParserHistoryEntry,
  JsonParserMetricsSummary,
  JsonParserParseStatus,
  JsonParserPreviewMode,
  JsonParserTreeNode
} from '../../types/json-parser.types';
import {
  blurActiveElement,
  buildJsonParserLineNumbers,
  buildJsonParserTree,
  computeJsonParserMetrics,
  createJsonParserDiagnostic,
  createJsonParserErrorDiagnostic,
  createJsonParserIdleStringLiteralStatus,
  createJsonParserIdleStringifyStatus,
  filterJsonParserTree,
  flattenJsonParserTree,
  formatJsonParserParsedValue,
  formatJsonParserPreviewOutput,
  resolveJsonParserPathValue,
  resolveJsonParserSuggestion,
  tryParseJsonParserInput
} from '../../utils/json-parser.utils';

@Component({
  selector: 'lib-json-parser',
  standalone: true,
  templateUrl: './json-parser.html',
  styleUrls: ['./json-parser.scss'],
  imports: [
    DecimalPipe,
    NgIf,
    NgFor,
    NgTemplateOutlet,
    TitleCasePipe,
    FormsModule,
    RouterLink,
    Navigation,
    TooltipDirective
  ]
})
export class JsonParserComponent implements AfterViewInit {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('inputLineNumbers') inputLineNumbers!: ElementRef<HTMLElement>;

  private dismissedSuggestionId: string | null = null;

  readonly heroHighlights = JSON_PARSER_HERO_HIGHLIGHTS;
  readonly previewModes = JSON_PARSER_PREVIEW_MODES;
  readonly stringifyPlaceholder = JSON_PARSER_STRINGIFY_PLACEHOLDER;
  readonly stringLiteralPlaceholder = JSON_PARSER_STRING_LITERAL_PLACEHOLDER;
  readonly relatedTools: ReadonlyArray<DcRelatedToolLink> = JSON_PARSER_RELATED_TOOLS;

  jsonInput = '';
  formattedOutput = '';
  previewMode: JsonParserPreviewMode = 'formatted';
  filterTerm = '';

  parseStatus: JsonParserParseStatus = {
    status: 'idle',
    message: 'Paste JSON and click “Parse” to explore the structure.'
  };

  metrics: JsonParserMetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B'
  };

  diagnostics: JsonParserDiagnostic[] = [];
  operationHistory: JsonParserHistoryEntry[] = [];

  treeNodes: JsonParserTreeNode[] = [];
  filteredTree: JsonParserTreeNode[] = [];
  selectedNode?: JsonParserTreeNode;

  copyStatus: JsonParserCopyStatus = 'idle';
  copyMessage = '';

  stringifyInput = '';
  stringifyOutput = '';
  stringifyStatus: JsonParserParseStatus;
  stringifyDiagnostic?: JsonParserDiagnostic;

  stringLiteralInput = '';
  stringLiteralOutput = '';
  stringLiteralStatus: JsonParserParseStatus;
  stringLiteralDiagnostic?: JsonParserDiagnostic;
  editorLines: number[] = [];
  resultLines: number[] = [];

  constructor() {
    this.stringifyStatus = createJsonParserIdleStringifyStatus();
    this.stringLiteralStatus = createJsonParserIdleStringLiteralStatus();
    this.loadSample();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
  }

  get nodeCount(): number {
    return flattenJsonParserTree(this.treeNodes).length;
  }

  get primarySuggestion(): DcToolSuggestion | null {
    const suggestion = resolveJsonParserSuggestion({
      source: this.jsonInput,
      hasTree: this.treeNodes.length > 0,
      parseStatus: this.parseStatus.status
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
    this.updateMetrics(value);
    this.parseStatus = {
      status: 'idle',
      message: 'Ready to parse the provided JSON.'
    };
    this.diagnostics = [];
    this.treeNodes = [];
    this.filteredTree = [];
    this.formattedOutput = '';
    this.updateResultLineNumbers();
  }

  onEditorScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = this.inputLineNumbers?.nativeElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  copyInput(): void {
    void this.copyToClipboard(this.jsonInput, 'Input copied');
  }

  setPreviewMode(mode: JsonParserPreviewMode): void {
    this.previewMode = mode;
    if (this.treeNodes.length) {
      this.buildFormattedOutput(this.treeNodes);
    }
    blurActiveElement();
  }

  parseJson(): void {
    blurActiveElement();

    if (!this.jsonInput.trim()) {
      this.parseStatus = {
        status: 'error',
        message: 'Paste JSON to parse before continuing. The input field is empty.'
      };
      this.diagnostics = [
        createJsonParserDiagnostic('No JSON content found. Paste JSON and try again.')
      ];
      this.treeNodes = [];
      this.filteredTree = [];
      this.formattedOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    try {
      const parsed = JSON.parse(this.jsonInput);
      this.treeNodes = buildJsonParserTree(parsed, '$', 0);
      this.filteredTree = this.treeNodes;
      this.buildFormattedOutput(this.treeNodes);
      this.updateResultLineNumbers();
      this.parseStatus = {
        status: 'success',
        message: `JSON parsed successfully. Found ${this.nodeCount} node(s).`
      };
      this.diagnostics = [];
      this.recordHistory('Parsed JSON successfully');
    } catch (error) {
      const diagnostic = createJsonParserErrorDiagnostic(error, this.jsonInput);
      this.parseStatus = {
        status: 'error',
        message: `JSON Parse Error: ${diagnostic.message}. Please check your JSON syntax and try again.`
      };
      this.diagnostics = [diagnostic];
      this.treeNodes = [];
      this.filteredTree = [];
      this.formattedOutput = '';
      this.updateResultLineNumbers();
    }
  }

  formatJson(): void {
    blurActiveElement();

    const parseAttempt = tryParseJsonParserInput(this.jsonInput);
    if (!parseAttempt.success) {
      this.diagnostics = [parseAttempt.diagnostic];
      this.parseStatus = {
        status: 'error',
        message: `Format Error: ${parseAttempt.diagnostic.message}. Please fix the JSON syntax before formatting.`
      };
      return;
    }

    this.jsonInput = JSON.stringify(parseAttempt.value, null, 2);
    this.onJsonInputChange(this.jsonInput);
    this.parseStatus = {
      status: 'success',
      message: 'JSON formatted with 2-space indentation.'
    };
    this.diagnostics = [createJsonParserDiagnostic('JSON formatted successfully.')];
    this.recordHistory('Formatted JSON input');
  }

  minifyJson(): void {
    blurActiveElement();

    const parseAttempt = tryParseJsonParserInput(this.jsonInput);
    if (!parseAttempt.success) {
      this.diagnostics = [parseAttempt.diagnostic];
      this.parseStatus = {
        status: 'error',
        message: `Minify Error: ${parseAttempt.diagnostic.message}. Please fix the JSON syntax before minifying.`
      };
      return;
    }

    this.jsonInput = JSON.stringify(parseAttempt.value);
    this.onJsonInputChange(this.jsonInput);
    this.parseStatus = {
      status: 'success',
      message: 'JSON minified successfully.'
    };
    this.diagnostics = [createJsonParserDiagnostic('JSON minified successfully.')];
    this.recordHistory('Minified JSON input');
  }

  resetWorkspace(): void {
    blurActiveElement();
    this.loadSample();
  }

  onStringifyInputChange(value: string): void {
    this.stringifyInput = value;
    if (!value.trim()) {
      this.stringifyOutput = '';
      this.stringifyDiagnostic = undefined;
      this.stringifyStatus = createJsonParserIdleStringifyStatus();
    }
  }

  stringifyJsonInput(): void {
    blurActiveElement();

    if (!this.stringifyInput.trim()) {
      this.stringifyStatus = {
        status: 'error',
        message: 'Provide JSON content before stringifying. The input field is empty.'
      };
      this.stringifyOutput = '';
      this.stringifyDiagnostic = undefined;
      return;
    }

    try {
      const parsed = JSON.parse(this.stringifyInput);
      this.stringifyOutput = JSON.stringify(parsed);
      this.stringifyStatus = {
        status: 'success',
        message: 'JSON stringified to a compact single-line string.'
      };
      this.stringifyDiagnostic = undefined;
      this.recordHistory('Stringified JSON snippet');
    } catch (error) {
      const diagnostic = createJsonParserErrorDiagnostic(error, this.stringifyInput);
      this.stringifyStatus = {
        status: 'error',
        message: `Stringify Error: ${diagnostic.message}. Please check your JSON syntax and try again.`
      };
      this.stringifyOutput = '';
      this.stringifyDiagnostic = diagnostic;
    }
  }

  async copyStringifyOutput(): Promise<void> {
    if (!this.stringifyOutput) {
      return;
    }
    await this.copyToClipboard(this.stringifyOutput, 'Stringified JSON copied');
  }

  onStringLiteralInputChange(value: string): void {
    this.stringLiteralInput = value;
    if (!value.trim()) {
      this.stringLiteralOutput = '';
      this.stringLiteralDiagnostic = undefined;
      this.stringLiteralStatus = createJsonParserIdleStringLiteralStatus();
    }
  }

  parseStringLiteral(): void {
    blurActiveElement();

    if (!this.stringLiteralInput.trim()) {
      this.stringLiteralStatus = {
        status: 'error',
        message: 'Paste a stringified JSON value before converting. The input field is empty.'
      };
      this.stringLiteralOutput = '';
      this.stringLiteralDiagnostic = undefined;
      return;
    }

    try {
      const parsed = JSON.parse(this.stringLiteralInput);
      this.stringLiteralOutput = formatJsonParserParsedValue(parsed);
      this.stringLiteralStatus = {
        status: 'success',
        message: 'Stringified JSON converted successfully.'
      };
      this.stringLiteralDiagnostic = undefined;
      this.recordHistory('Converted stringified JSON to formatted output');
    } catch (error) {
      const diagnostic = createJsonParserErrorDiagnostic(error, this.stringLiteralInput);
      this.stringLiteralStatus = {
        status: 'error',
        message: `Parse Error: ${diagnostic.message}. Please check your JSON syntax and try again.`
      };
      this.stringLiteralOutput = '';
      this.stringLiteralDiagnostic = diagnostic;
    }
  }

  async copyStringLiteralOutput(): Promise<void> {
    if (!this.stringLiteralOutput) {
      return;
    }
    await this.copyToClipboard(this.stringLiteralOutput, 'Converted JSON copied');
  }

  filterTree(term: string): void {
    this.filterTerm = term;
    this.filteredTree = filterJsonParserTree(this.treeNodes, term);
  }

  toggleNode(node: JsonParserTreeNode): void {
    node.expanded = !node.expanded;
  }

  selectNode(node: JsonParserTreeNode): void {
    this.selectedNode = node;
    this.copyStatus = 'idle';
    this.copyMessage = '';
  }

  async copyPath(node: JsonParserTreeNode): Promise<void> {
    await this.copyToClipboard(node.path, 'JSONPath copied');
  }

  async copyValue(node: JsonParserTreeNode): Promise<void> {
    const parseAttempt = tryParseJsonParserInput(this.jsonInput);
    if (!parseAttempt.success) {
      return;
    }
    const value = resolveJsonParserPathValue(parseAttempt.value, node.path);
    await this.copyToClipboard(JSON.stringify(value, null, 2), 'Node value copied');
  }

  trackByHistory = (_index: number, entry: JsonParserHistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByNode = (_index: number, node: JsonParserTreeNode): string => node.id;

  trackByDiagnostic = (_index: number, diagnostic: JsonParserDiagnostic): string => diagnostic.id;

  copyToClipboardText(text: string): void {
    void dcCopyText(this.toast, text, 'Preview').then((ok) => {
      if (ok) {
        this.copyStatus = 'success';
        this.copyMessage = 'Preview copied';
      } else {
        this.copyStatus = 'error';
        this.copyMessage = 'Failed to copy preview';
      }
    });
  }

  private async copyToClipboard(text: string, message: string): Promise<void> {
    const label = message.replace(/\s+copied$/i, '') || 'Text';
    const ok = await dcCopyText(this.toast, text, label);
    if (ok) {
      this.copyStatus = 'success';
      this.copyMessage = message;
    } else {
      this.copyStatus = 'error';
      this.copyMessage =
        typeof navigator === 'undefined' || !navigator.clipboard?.writeText
          ? 'Clipboard API unavailable'
          : 'Failed to copy';
    }
    setTimeout(() => (this.copyStatus = 'idle'), 1500);
  }

  private loadSample(): void {
    this.jsonInput = JSON_PARSER_SAMPLE_JSON;
    this.dismissedSuggestionId = null;
    this.updateEditorLineNumbers();
    this.onJsonInputChange(this.jsonInput);
    this.parseStatus = {
      status: 'idle',
      message: 'Sample JSON loaded. Parse to explore the structure.'
    };
    this.operationHistory = [];
    this.diagnostics = [];
    this.treeNodes = [];
    this.filteredTree = [];
    this.selectedNode = undefined;
    this.copyStatus = 'idle';
    this.copyMessage = '';
    this.stringifyInput = '';
    this.stringifyOutput = '';
    this.stringifyStatus = createJsonParserIdleStringifyStatus();
    this.stringifyDiagnostic = undefined;
    this.stringLiteralInput = '';
    this.stringLiteralOutput = '';
    this.stringLiteralStatus = createJsonParserIdleStringLiteralStatus();
    this.stringLiteralDiagnostic = undefined;
  }

  private buildFormattedOutput(_tree: JsonParserTreeNode[]): void {
    const parseAttempt = tryParseJsonParserInput(this.jsonInput);
    if (!parseAttempt.success) {
      this.formattedOutput = '';
      this.updateResultLineNumbers();
      return;
    }
    this.formattedOutput = formatJsonParserPreviewOutput(parseAttempt.value, this.previewMode);
    this.updateResultLineNumbers();
  }

  private updateEditorLineNumbers(): void {
    this.editorLines = buildJsonParserLineNumbers(this.jsonInput);
  }

  private updateResultLineNumbers(): void {
    this.resultLines = buildJsonParserLineNumbers(this.formattedOutput);
  }

  private updateMetrics(value: string): void {
    this.metrics = computeJsonParserMetrics(value);
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(
      0,
      JSON_PARSER_HISTORY_LIMIT
    );
  }
}
