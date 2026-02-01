import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationComponent } from '@tools-workspace/features-home';

type CopyStatus = 'idle' | 'success' | 'error';
type ParseState = 'idle' | 'success' | 'error';

type PreviewMode = 'formatted' | 'minified';

type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ParseStatus {
  status: ParseState;
  message: string;
}

interface MetricsSummary {
  characters: number;
  lines: number;
  sizeLabel: string;
}

interface JsonTreeNode {
  id: string;
  key?: string;
  type: JsonNodeType;
  level: number;
  path: string;
  expanded: boolean;
  preview: string;
  children?: JsonTreeNode[];
}

interface Diagnostic {
  id: string;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

@Component({
  selector: 'lib-json-parser',
  standalone: true,
  templateUrl: './json-parser.html',
  styleUrls: ['./json-parser.scss'],
  imports: [CommonModule, NgIf, NgFor, NgTemplateOutlet, FormsModule, NavigationComponent]
})
export class JsonParserComponent implements AfterViewInit {
  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  readonly heroHighlights = [
    {
      title: 'Visual tree viewer',
      detail: 'Inspect nested objects and arrays with collapsible nodes and breadcrumb context.'
    },
    {
      title: 'Quick transformations',
      detail: 'Format, minify, or filter JSON keys before exporting the result.'
    },
    {
      title: 'Copy-friendly',
      detail: 'Grab JSONPath, raw values, or formatted output with a single click.'
    }
  ];

  readonly previewModes: Array<{ id: PreviewMode; label: string }> = [
    { id: 'formatted', label: 'Formatted' },
    { id: 'minified', label: 'Minified' }
  ];

  readonly stringifyPlaceholder = `{
  "title": "Example",
  "items": [1, 2, 3]
}`;

  readonly stringLiteralPlaceholder = '{"title":"Example","items":[1,2,3]}';

  jsonInput = '';
  formattedOutput = '';
  previewMode: PreviewMode = 'formatted';
  filterTerm = '';

  parseStatus: ParseStatus = {
    status: 'idle',
    message: 'Paste JSON and click “Parse” to explore the structure.'
  };

  metrics: MetricsSummary = {
    characters: 0,
    lines: 0,
    sizeLabel: '0 B'
  };

  diagnostics: Diagnostic[] = [];
  operationHistory: HistoryEntry[] = [];

  treeNodes: JsonTreeNode[] = [];
  filteredTree: JsonTreeNode[] = [];
  selectedNode?: JsonTreeNode;

  copyStatus: CopyStatus = 'idle';
  copyMessage = '';

  stringifyInput = '';
  stringifyOutput = '';
  stringifyStatus: ParseStatus;
  stringifyDiagnostic?: Diagnostic;

  stringLiteralInput = '';
  stringLiteralOutput = '';
  stringLiteralStatus: ParseStatus;
  stringLiteralDiagnostic?: Diagnostic;
  editorLines: number[] = [];
  resultLines: number[] = [];

  constructor() {
    this.stringifyStatus = this.createStringifyIdleStatus();
    this.stringLiteralStatus = this.createStringLiteralIdleStatus();
    this.loadSample();
  }

  ngAfterViewInit(): void {
    this.updateEditorLineNumbers();
    this.updateResultLineNumbers();
  }

  get nodeCount(): number {
    return this.flattenTree(this.treeNodes).length;
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
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
    const lineNumbers = document.querySelector('.editor-line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  setPreviewMode(mode: PreviewMode): void {
    this.previewMode = mode;
    if (this.treeNodes.length) {
      this.buildFormattedOutput(this.treeNodes);
    }
    // Remove focus from button to prevent tooltip persistence
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  parseJson(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!this.jsonInput.trim()) {
      this.parseStatus = {
        status: 'error',
        message: 'Paste JSON to parse before continuing. The input field is empty.'
      };
      this.diagnostics = [this.createDiagnostic('No JSON content found. Paste JSON and try again.')];
      this.treeNodes = [];
      this.filteredTree = [];
      this.formattedOutput = '';
      this.updateResultLineNumbers();
      return;
    }

    try {
      const parsed = JSON.parse(this.jsonInput);
      this.treeNodes = this.buildTree(parsed, '$', 0);
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
      const diagnostic = this.createErrorDiagnostic(error, this.jsonInput);
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
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const parseAttempt = this.tryParse();
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
    this.diagnostics = [this.createDiagnostic('JSON formatted successfully.')];
    this.recordHistory('Formatted JSON input');
  }

  minifyJson(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const parseAttempt = this.tryParse();
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
    this.diagnostics = [this.createDiagnostic('JSON minified successfully.')];
    this.recordHistory('Minified JSON input');
  }

  resetWorkspace(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.loadSample();
  }

  onStringifyInputChange(value: string): void {
    this.stringifyInput = value;
    if (!value.trim()) {
      this.stringifyOutput = '';
      this.stringifyDiagnostic = undefined;
      this.stringifyStatus = this.createStringifyIdleStatus();
    }
  }

  stringifyJsonInput(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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
      const diagnostic = this.createErrorDiagnostic(error, this.stringifyInput);
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
      this.stringLiteralStatus = this.createStringLiteralIdleStatus();
    }
  }

  parseStringLiteral(): void {
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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
      this.stringLiteralOutput = this.formatParsedValue(parsed);
      this.stringLiteralStatus = {
        status: 'success',
        message: 'Stringified JSON converted successfully.'
      };
      this.stringLiteralDiagnostic = undefined;
      this.recordHistory('Converted stringified JSON to formatted output');
    } catch (error) {
      const diagnostic = this.createErrorDiagnostic(error, this.stringLiteralInput);
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
    if (!term.trim()) {
      this.filteredTree = this.treeNodes;
      return;
    }
    const matches = new Set(
      this.flattenTree(this.treeNodes)
        .filter((node) =>
          (node.key && node.key.toLowerCase().includes(term.toLowerCase())) ||
          node.preview.toLowerCase().includes(term.toLowerCase()) ||
          node.path.toLowerCase().includes(term.toLowerCase())
        )
        .map((node) => node.path)
    );

    const filterRecursive = (nodes: JsonTreeNode[]): JsonTreeNode[] =>
      nodes
        .map((node) => {
          const children = node.children ? filterRecursive(node.children) : undefined;
          const includeNode = matches.has(node.path) || (children && children.length > 0);
          if (!includeNode) {
            return null;
          }
          return {
            ...node,
            expanded: true,
            children
          } as JsonTreeNode;
        })
        .filter((node): node is JsonTreeNode => node !== null);

    this.filteredTree = filterRecursive(this.treeNodes);
  }

  toggleNode(node: JsonTreeNode): void {
    node.expanded = !node.expanded;
  }

  selectNode(node: JsonTreeNode): void {
    this.selectedNode = node;
    this.copyStatus = 'idle';
    this.copyMessage = '';
  }

  async copyPath(node: JsonTreeNode): Promise<void> {
    await this.copyToClipboard(node.path, 'JSONPath copied');
  }

  async copyValue(node: JsonTreeNode): Promise<void> {
    const parseAttempt = this.tryParse();
    if (!parseAttempt.success) {
      return;
    }
    const value = this.resolvePathValue(parseAttempt.value, node.path);
    await this.copyToClipboard(JSON.stringify(value, null, 2), 'Node value copied');
  }

  trackByHistory = (_index: number, entry: HistoryEntry): string =>
    `${entry.label}-${entry.timestamp}`;

  trackByNode = (_index: number, node: JsonTreeNode): string => node.id;

  trackByDiagnostic = (_index: number, diagnostic: Diagnostic): string => diagnostic.id;

  private async copyToClipboard(text: string, message: string): Promise<void> {
    try {
      const navigatorRef = (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
      if (!navigatorRef?.clipboard?.writeText) {
        this.copyStatus = 'error';
        this.copyMessage = 'Clipboard API unavailable';
        setTimeout(() => (this.copyStatus = 'idle'), 1500);
        return;
      }
      await navigatorRef.clipboard.writeText(text);
      this.copyStatus = 'success';
      this.copyMessage = message;
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    } catch {
      this.copyStatus = 'error';
      this.copyMessage = 'Failed to copy';
      setTimeout(() => (this.copyStatus = 'idle'), 1500);
    }
  }

  private loadSample(): void {
    this.jsonInput = `{
  "meta": {
    "title": "Example dataset",
    "version": 2,
    "published": true
  },
  "authors": [
    {
      "name": "Ada Lovelace",
      "role": "Analyst",
      "social": {
        "github": "ada",
        "twitter": "@ada"
      }
    },
    {
      "name": "Alan Turing",
      "role": "Researcher",
      "social": {
        "github": "aturing",
        "twitter": "@aturing"
      }
    }
  ]
}`;
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
    this.stringifyStatus = this.createStringifyIdleStatus();
    this.stringifyDiagnostic = undefined;
    this.stringLiteralInput = '';
    this.stringLiteralOutput = '';
    this.stringLiteralStatus = this.createStringLiteralIdleStatus();
    this.stringLiteralDiagnostic = undefined;
  }

  private buildFormattedOutput(tree: JsonTreeNode[]): void {
    const parseAttempt = this.tryParse();
    if (!parseAttempt.success) {
      this.formattedOutput = '';
      this.updateResultLineNumbers();
      return;
    }
    const value = parseAttempt.value;
    this.formattedOutput = this.previewMode === 'formatted'
      ? JSON.stringify(value, null, 2)
      : JSON.stringify(value);
    this.updateResultLineNumbers();
  }

  private updateEditorLineNumbers(): void {
    const lines = this.jsonInput.split(/\r?\n/).length;
    this.editorLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private updateResultLineNumbers(): void {
    const lines = this.formattedOutput.split(/\r?\n/).length;
    this.resultLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private buildTree(value: unknown, path: string, level: number, key?: string): JsonTreeNode[] {
    const node = this.createTreeNode(value, path, level, key);
    if (value !== null && typeof value === 'object') {
      const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
      node.children = [];
      for (const [childKey, childValue] of entries as Iterable<[string | number, unknown]>) {
        const childPath = Array.isArray(value)
          ? `${path}[${childKey}]`
          : `${path}.${childKey}`;
        const childNodes = this.buildTree(childValue, childPath, level + 1, String(childKey));
        node.children.push(...childNodes);
      }
      node.expanded = level < 1;
    }
    return [node];
  }

  private createTreeNode(value: unknown, path: string, level: number, key?: string): JsonTreeNode {
    const type = this.resolveType(value);
    const preview = this.createPreview(value, type);
    return {
      id: `${path}-${level}-${Math.random().toString(36).slice(2, 8)}`,
      key,
      type,
      level,
      path,
      expanded: level < 1,
      preview
    };
  }

  private createPreview(value: unknown, type: JsonNodeType): string {
    if (type === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      return `Object {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
    }
    if (type === 'array') {
      const length = (value as unknown[]).length;
      return `Array(${length})`;
    }
    if (type === 'string') {
      const text = String(value);
      return text.length > 40 ? `${text.slice(0, 37)}…` : text;
    }
    return String(value);
  }

  private resolveType(value: unknown): JsonNodeType {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    switch (typeof value) {
      case 'object':
        return 'object';
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      default:
        return 'string';
    }
  }

  private flattenTree(nodes: JsonTreeNode[]): JsonTreeNode[] {
    const result: JsonTreeNode[] = [];
    const stack = [...nodes];
    while (stack.length) {
      const node = stack.shift()!;
      result.push(node);
      if (node.children) {
        stack.unshift(...node.children);
      }
    }
    return result;
  }

  private resolvePathValue(value: unknown, path: string): unknown {
    if (path === '$') {
      return value;
    }
    const segments = path
      .replace(/\$\.?/, '')
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter((segment) => segment.length);

    return segments.reduce((current: any, segment) => {
      if (current == null) {
        return undefined;
      }
      return current[segment];
    }, value as any);
  }

  private tryParse(): { success: true; value: unknown } | { success: false; diagnostic: Diagnostic } {
    if (!this.jsonInput.trim()) {
      return {
        success: false,
        diagnostic: this.createDiagnostic('Paste JSON before formatting or minifying.')
      };
    }
    try {
      const parsed = JSON.parse(this.jsonInput);
      return { success: true, value: parsed };
    } catch (error) {
      return {
        success: false,
        diagnostic: this.createErrorDiagnostic(error, this.jsonInput)
      };
    }
  }

  private createErrorDiagnostic(error: unknown, source: string): Diagnostic {
    const message = error instanceof Error ? error.message : 'Unknown JSON parsing error.';
    const position = this.extractErrorPosition(message);
    if (position === null) {
      return this.createDiagnostic(message);
    }
    const { line, column } = this.computeLineAndColumn(source, position);
    const snippet = this.getSnippet(source, line);
    return {
      id: this.createDiagnosticId(),
      message,
      line,
      column,
      snippet
    };
  }

  private extractErrorPosition(message: string): number | null {
    const match = message.match(/position\s+(\d+)/i);
    if (match && match[1]) {
      return Number.parseInt(match[1], 10);
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

  private getSnippet(source: string, line: number): string {
    const lines = source.split(/\r?\n/);
    return lines[line - 1]?.trim() ?? '';
  }

  private createDiagnostic(message: string): Diagnostic {
    return {
      id: this.createDiagnosticId(),
      message
    };
  }

  private updateMetrics(value: string): void {
    const characters = value.length;
    const lines = value.split(/\r?\n/).length;
    const sizeLabel = this.formatBytes(new Blob([value]).size);
    this.metrics = { characters, lines, sizeLabel };
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

  private resolveTypeLabel(type: JsonNodeType): string {
    switch (type) {
      case 'object':
        return 'Object';
      case 'array':
        return 'Array';
      case 'string':
        return 'String';
      case 'number':
        return 'Number';
      case 'boolean':
        return 'Boolean';
      case 'null':
        return 'Null';
      default:
        return 'Value';
    }
  }

  private createDiagnosticId(): string {
    return `diag-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  copyToClipboardText(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copyStatus = 'success';
      this.copyMessage = 'Preview copied';
    }).catch(() => {
      this.copyStatus = 'error';
      this.copyMessage = 'Failed to copy preview';
    });
  }

  private createStringifyIdleStatus(): ParseStatus {
    return {
      status: 'idle',
      message: 'Provide JSON to stringify into a single-line representation.'
    };
  }

  private createStringLiteralIdleStatus(): ParseStatus {
    return {
      status: 'idle',
      message: 'Paste a stringified JSON value to convert it back to readable JSON.'
    };
  }

  private formatParsedValue(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value, null, 2);
  }
}
