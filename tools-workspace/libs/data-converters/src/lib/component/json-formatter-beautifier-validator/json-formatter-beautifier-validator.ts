import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { FlexLayoutModule } from '@angular/flex-layout';

type ResultTab = 'formatted' | 'tree' | 'validation';

interface OperationHistoryEntry {
  label: string;
  timestamp: string;
}

interface ValidationResult {
  status: 'success' | 'error';
  message: string;
  line?: number;
  column?: number;
  excerpt?: string;
}

interface InputMetrics {
  characters: number;
  lines: number;
  sizeLabel: string;
}

interface JsonTreeNode {
  id: string;
  level: number;
  key?: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  preview: string;
  metadata?: string;
  expanded: boolean;
  children?: JsonTreeNode[];
}

const DEFAULT_SAMPLE = {
  tool: 'JSON Formatter & Validator',
  description:
    'Paste JSON, format it with your preferred indentation, and validate the structure instantly.',
  settings: {
    indentation: 2,
    autoValidate: true,
    theme: 'system'
  },
  metadata: {
    author: 'Tools Workspace',
    updated: '2025-10-01',
    tags: ['json', 'format', 'validate']
  },
  payload: [
    { id: 1, label: 'Formatter', active: true },
    { id: 2, label: 'Validator', active: true },
    { id: 3, label: 'Tree View', active: false }
  ]
};

@Component({
  selector: 'lib-json-formatter-beautifier-validator',
  standalone: true,
  templateUrl: './json-formatter-beautifier-validator.html',
  styleUrls: ['./json-formatter-beautifier-validator.scss'],
  imports: [CommonModule, FormsModule, Navigation, FlexLayoutModule]
})
export class JsonFormatterBeautifierValidatorComponent {
  readonly resultTabs: Array<{ id: ResultTab; label: string; description: string }> = [
    {
      id: 'formatted',
      label: 'Formatted',
      description: 'Beautified or minified JSON output ready to copy or download.'
    },
    {
      id: 'tree',
      label: 'Tree',
      description: 'Navigate the JSON structure with collapsible nodes for quick inspection.'
    },
    {
      id: 'validation',
      label: 'Validation',
      description: 'Syntax feedback with precise line and column references.'
    }
  ];

  readonly indentationOptions = [2, 4, 6];

  readonly formatterTips = [
    'Use the beautify action to reformat pasted JSON and instantly clean up indentation.',
    'Switch to the tree view to navigate large payloads without scrolling through raw text.',
    'Minify before sending JSON to APIs to keep payloads lean and performant.',
    'Auto-validation keeps an eye on syntax while you type—toggle it off for massive files.'
  ];

  readonly usageSteps = [
    'Paste or drop a JSON file into the editor. A sample payload loads by default.',
    'Pick your indentation preference, then beautify or minify with a single click.',
    'Toggle validation to inspect errors, including line and column references.',
    'Copy, download, or explore the tree view before sharing the payload with your team.'
  ];

  readonly callouts = [
    { title: 'Single Source', detail: 'Work with one JSON document at a time with zero distractions.' },
    { title: 'Instant Feedback', detail: 'Validation highlights the exact line and column of issues.' },
    {
      title: 'Shareable Output',
      detail: 'Copy to clipboard or download the formatted file for documentation.'
    }
  ];

  activeResultTab: ResultTab = 'formatted';
  rawInput = '';
  formattedOutput = '';
  indentSize = this.indentationOptions[0];
  indentStyle: 'spaces' | 'tabs' = 'spaces';
  autoValidate = true;

  validationResult: ValidationResult | null = null;
  operationHistory: OperationHistoryEntry[] = [];
  inputMetrics: InputMetrics = { characters: 0, lines: 0, sizeLabel: '0 B' };
  treeNodes: JsonTreeNode[] = [];
  copyStatus: 'idle' | 'success' | 'error' = 'idle';
  lastFormatMode: 'beautify' | 'minify' | null = null;
  isDragOver = false;

  constructor() {
    this.loadSamplePayload();
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

  onIndentSizeChange(size: number): void {
    this.indentSize = size;
    this.autoFormatWhenPossible();
  }

  onIndentStyleChange(style: 'spaces' | 'tabs'): void {
    this.indentStyle = style;
    this.autoFormatWhenPossible();
  }

  onRawInputChange(value: string): void {
    this.rawInput = value;
    this.updateInputMetrics(value);
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

  setActiveResultTab(tab: ResultTab): void {
    this.activeResultTab = tab;
  }

  formatJson(): void {
    const indent =
      this.indentStyle === 'tabs' ? '\t' : new Array(this.indentSize).fill(' ').join('');
    const parseResult = this.safeParse(this.rawInput);
    if (!parseResult.success) {
      this.validationResult = parseResult.error;
      this.activeResultTab = 'validation';
      this.lastFormatMode = null;
      return;
    }

    this.formattedOutput = JSON.stringify(parseResult.value, null, indent);
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
    const parseResult = this.safeParse(this.rawInput);
    if (!parseResult.success) {
      this.validationResult = parseResult.error;
      this.activeResultTab = 'validation';
      this.lastFormatMode = null;
      return;
    }

    this.formattedOutput = JSON.stringify(parseResult.value);
    this.validationResult = {
      status: 'success',
      message: 'Minified JSON payload.'
    };
    this.activeResultTab = 'formatted';
    this.lastFormatMode = 'minify';
    this.recordHistory('Minified JSON');
    this.updateTree(parseResult.value);
  }

  validateJson(updateTree = true, setActiveTab = true): void {
    const parseResult = this.safeParse(this.rawInput);
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

    try {
      const navigatorRef = (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
      if (!navigatorRef?.clipboard?.writeText) {
        this.copyStatus = 'error';
        setTimeout(() => (this.copyStatus = 'idle'), 1600);
        return;
      }

      await navigatorRef.clipboard.writeText(this.formattedOutput);
      this.copyStatus = 'success';
      this.recordHistory('Copied formatted JSON');
      setTimeout(() => (this.copyStatus = 'idle'), 1600);
    } catch (error) {
      console.warn('Unable to copy JSON to clipboard.', error);
      this.copyStatus = 'error';
      setTimeout(() => (this.copyStatus = 'idle'), 1600);
    }
  }

  downloadFormatted(): void {
    if (!this.formattedOutputAvailable) {
      return;
    }
    const blob = new Blob([this.formattedOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');
    link.download = `formatted-json-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory('Downloaded formatted JSON');
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

  private loadSamplePayload(): void {
    this.rawInput = JSON.stringify(DEFAULT_SAMPLE, null, 2);
    this.formattedOutput = this.rawInput;
    this.updateInputMetrics(this.rawInput);
    this.validationResult = {
      status: 'success',
      message: 'Sample JSON loaded. Ready for formatting or validation.'
    };
    this.updateTree(DEFAULT_SAMPLE);
    this.operationHistory = [];
    this.copyStatus = 'idle';
    this.lastFormatMode = 'beautify';
    this.activeResultTab = 'formatted';
  }

  private safeParse(source: string): { success: true; value: unknown } | { success: false; error: ValidationResult } {
    try {
      const parsed = JSON.parse(source);
      return { success: true, value: parsed };
    } catch (error) {
      const result = this.buildParseError(error, source);
      return { success: false, error: result };
    }
  }

  private buildParseError(error: unknown, source: string): ValidationResult {
    const message = error instanceof Error ? error.message : 'Unknown parsing error.';
    let position: number | undefined;

    const match = /position (\d+)/i.exec(message);
    if (match) {
      position = Number.parseInt(match[1], 10);
    }

    if (position === undefined) {
      const unexpectedMatch = /column (\d+)/i.exec(message);
      if (unexpectedMatch) {
        position = Number.parseInt(unexpectedMatch[1], 10);
      }
    }

    if (position === undefined) {
      return {
        status: 'error',
        message
      };
    }

    const { line, column } = this.calculateLineAndColumn(source, position);
    const excerpt = this.buildExcerpt(source, line, column);

    return {
      status: 'error',
      message,
      line,
      column,
      excerpt
    };
  }

  private calculateLineAndColumn(source: string, position: number): { line: number; column: number } {
    const snippet = source.slice(0, position);
    const segments = snippet.split(/\r?\n/);
    const line = segments.length;
    const column = (segments[segments.length - 1] || '').length + 1;
    return { line, column };
  }

  private buildExcerpt(source: string, line: number, column: number): string {
    const lines = source.split(/\r?\n/);
    const target = lines[line - 1] ?? '';
    const caretLine = `${' '.repeat(Math.max(column - 1, 0))}^`;
    return `${target}\n${caretLine}`;
  }

  private updateInputMetrics(value: string): void {
    const characters = value.length;
    const lines = value.split(/\r?\n/).length;
    const sizeLabel = this.formatBytes(new Blob([value]).size);
    this.inputMetrics = { characters, lines, sizeLabel };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 5);
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
        this.validationResult = null;
        this.lastFormatMode = null;
      })
      .catch(() => {
        this.validationResult = {
          status: 'error',
          message: 'Could not read the selected file. Please try another JSON file.'
        };
      });
  }

  private updateTree(value: unknown): void {
    this.treeNodes = this.generateTreeNodes(value, 0);
  }

  private generateTreeNodes(value: unknown, level: number, key?: string): JsonTreeNode[] {
    const type = this.resolveType(value);
    const id = `${level}-${key ?? 'root'}-${Math.random().toString(36).slice(2, 8)}`;
    const isExpandable = type === 'object' || type === 'array';

    const node: JsonTreeNode = {
      id,
      level,
      key,
      type,
      preview: this.buildPreview(value),
      metadata: this.buildMetadata(value),
      expanded: level < 1
    };

    if (isExpandable) {
      node.children = [];
      if (type === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        node.children = entries.flatMap(([childKey, childValue]) =>
          this.generateTreeNodes(childValue, level + 1, childKey)
        );
      } else {
        const arrayValue = value as unknown[];
        node.children = arrayValue.flatMap((item, index) =>
          this.generateTreeNodes(item, level + 1, `[${index}]`)
        );
      }
    }

    return [node];
  }

  private buildPreview(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return `Array (${value.length})`;
    }
    if (typeof value === 'object') {
      const length = Object.keys(value as Record<string, unknown>).length;
      return `Object (${length})`;
    }
    if (typeof value === 'string') {
      const trimmed = value.length > 60 ? `${value.slice(0, 57)}...` : value;
      return `"${trimmed}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    if (value === undefined) {
      return 'undefined';
    }
    return '';
  }

  private buildMetadata(value: unknown): string | undefined {
    if (value === null) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.length === 0 ? 'Empty array' : undefined;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      return keys.length === 0 ? 'Empty object' : undefined;
    }
    if (typeof value === 'string') {
      return `${value.length} characters`;
    }
    return undefined;
  }

  private resolveType(value: unknown): JsonTreeNode['type'] {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return 'array';
    }
    if (typeof value === 'object') {
      return 'object';
    }
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    return 'string';
  }

}
