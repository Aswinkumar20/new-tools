import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationComponent } from '@tools-workspace/features-home';

type ConversionMode = 'yaml-to-json' | 'json-to-yaml';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ConversionStatus {
  status: 'idle' | 'success' | 'error';
  message: string;
}

interface MetricsSummary {
  lines: number;
  sizeLabel: string;
  selection: string;
}

const SAMPLE_YAML = `users:
  - id: 1
    name: Ada Lovelace
    active: true
  - id: 2
    name: Alan Turing
    active: false
settings:
  theme: dark
  notifications: true`;

const SAMPLE_JSON = `{
  "project": "Atlas",
  "version": "1.0.0",
  "owners": [
    {
      "name": "Chris",
      "email": "chris@example.com"
    },
    {
      "name": "Morgan",
      "email": "morgan@example.com"
    }
  ]
}`;

@Component({
  selector: 'lib-yaml-to-json-json-to-yaml',
  standalone: true,
  templateUrl: './yaml-to-json-json-to-yaml.html',
  styleUrls: ['./yaml-to-json-json-to-yaml.scss'],
  imports: [CommonModule, NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault, FormsModule, NavigationComponent]
})
export class YamlToJsonJsonToYamlComponent implements AfterViewInit {
  @ViewChild('yamlTextarea') yamlTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('jsonTextarea') jsonTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('resultsTextarea') resultsTextarea!: ElementRef<HTMLTextAreaElement>;
  readonly modes: Array<{ id: ConversionMode; label: string; description: string }> = [
    {
      id: 'yaml-to-json',
      label: 'YAML → JSON',
      description: 'Convert configuration files into JSON for APIs, tooling, or automation.'
    },
    {
      id: 'json-to-yaml',
      label: 'JSON → YAML',
      description: 'Produce readable YAML from JSON with indentation and quoting controls.'
    }
  ];

  readonly usageSteps = [
    'Pick the conversion direction you need.',
    'Paste or drop YAML/JSON into the editor and tweak indentation options.',
    'Run the conversion. We surface syntax errors with helpful messages.',
    'Copy or download the result and reuse recent actions from the history log.'
  ];

  readonly callouts = [
    { title: 'Two-way converter', detail: 'Swap between YAML and JSON without leaving the page.' },
    { title: 'Whitespace aware', detail: 'Preserve indentation and optionally sort object keys.' },
    { title: 'Share ready', detail: 'Copy to clipboard or download to share with your team instantly.' }
  ];

  conversionMode: ConversionMode = 'yaml-to-json';

  yamlInput = '';
  jsonInput = '';
  resultOutput = '';

  yamlIndent = 2;
  yamlSortKeys = false;
  yamlQuoteStrings = true;

  jsonPrettyPrint = true;
  jsonSortKeys = false;

  conversionStatus: ConversionStatus = { status: 'idle', message: 'Load a sample or paste your data.' };
  metrics: MetricsSummary = { lines: 0, sizeLabel: '0 B', selection: 'YAML' };
  operationHistory: HistoryEntry[] = [];

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
    this.yamlInput = '';
    this.jsonInput = '';
    this.resultOutput = '';

    // Reset metrics according to new mode
    this.metrics = {
      lines: 0,
      sizeLabel: '0 B',
      selection: mode === 'yaml-to-json' ? 'YAML' : 'JSON'
    };

    // Reset operation history
    this.operationHistory = [];

    // Reset copy status
    this.copyStatus = 'idle';

    // Load sample data according to the new mode (this will set status and update line numbers)
    this.loadSample();
  }

  onYamlInputChange(value: string): void {
    this.yamlInput = value;
    this.updateMetrics(value, 'YAML');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'yaml-to-json') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert YAML into JSON.' };
    }
  }

  onJsonInputChange(value: string): void {
    this.jsonInput = value;
    this.updateMetrics(value, 'JSON');
    this.updateEditorLineNumbers();
    if (this.conversionMode === 'json-to-yaml') {
      this.conversionStatus = { status: 'idle', message: 'Ready to convert JSON into YAML.' };
    }
  }

  onEditorScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.editor-line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
  }

  onResultsScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const lineNumbers = document.querySelector('.results-output__line-numbers') as HTMLElement;
    if (lineNumbers) {
      lineNumbers.scrollTop = target.scrollTop;
    }
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
    // Remove focus from button to prevent tooltip persistence after click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.conversionStatus = { status: 'idle', message: 'Converting…' };
    if (this.conversionMode === 'yaml-to-json') {
      this.handleYamlToJson();
    } else {
      this.handleJsonToYaml();
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
      this.recordHistory(`Copied ${this.conversionMode === 'yaml-to-json' ? 'JSON' : 'YAML'} result`);
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
    const extension = this.conversionMode === 'yaml-to-json' ? 'json' : 'yml';
    const type = extension === 'json' ? 'application/json' : 'text/yaml';
    const blob = new Blob([this.resultOutput], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date()
      .toISOString()
      .split(':')
      .join('-')
      .split('.')
      .join('-');
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

  private handleYamlToJson(): void {
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
      const parsed = this.parseYaml(this.yamlInput);
      const sorted = this.jsonSortKeys ? this.sortObject(parsed) : parsed;
      this.resultOutput = JSON.stringify(sorted, null, this.jsonPrettyPrint ? 2 : undefined);
      this.updateResultLineNumbers();
      this.metrics = {
        lines: this.resultOutput.split(/\r?\n/).length,
        sizeLabel: this.formatBytes(new Blob([this.resultOutput]).size),
        selection: 'JSON'
      };
      this.conversionStatus = {
        status: 'success',
        message: 'Converted YAML to JSON.'
      };
      this.recordHistory('Converted YAML to JSON');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to parse YAML. Check indentation or syntax.';
      this.conversionStatus = {
        status: 'error',
        message: `YAML Parse Error: ${errorMessage}. Please check your YAML syntax, indentation, and try again.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private handleJsonToYaml(): void {
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
      parsed = this.sortObject(parsed);
    }

    try {
      this.resultOutput = this.stringifyToYaml(parsed, 0);
      this.updateResultLineNumbers();
      this.metrics = {
        lines: this.resultOutput.split(/\r?\n/).length,
        sizeLabel: this.formatBytes(new Blob([this.resultOutput]).size),
        selection: 'YAML'
      };
      this.conversionStatus = {
        status: 'success',
        message: 'Converted JSON to YAML.'
      };
      this.recordHistory('Converted JSON to YAML');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to serialize JSON into YAML.';
      this.conversionStatus = {
        status: 'error',
        message: `YAML Generation Error: ${errorMessage}. Please ensure your JSON structure is valid.`
      };
      this.resultOutput = '';
      this.updateResultLineNumbers();
    }
  }

  private parseYaml(source: string): unknown {
    const sanitized = source
      .replace(/\t/g, '  ')
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+#.*$/, ''));

    const lines: Array<{ indent: number; content: string }> = [];
    sanitized.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      const indent = line.length - line.trimStart().length;
      lines.push({ indent, content: trimmed });
    });

    if (!lines.length) {
      return {};
    }

    const { value, nextIndex } = this.parseYamlBlock(lines, 0, lines[0].indent);
    if (nextIndex < lines.length) {
      throw new Error('Unable to parse YAML: unexpected indentation or syntax near the end.');
    }
    return value;
  }

  private parseYamlBlock(
    lines: Array<{ indent: number; content: string }>,
    startIndex: number,
    currentIndent: number
  ): { value: unknown; nextIndex: number } {
    if (startIndex >= lines.length) {
      return { value: {}, nextIndex: startIndex };
    }

    const firstLine = lines[startIndex];
    const isArrayMode = firstLine.content.startsWith('- ');
    if (isArrayMode) {
      const items: unknown[] = [];
      let index = startIndex;
      while (index < lines.length) {
        const line = lines[index];
        if (line.indent < currentIndent || !line.content.startsWith('- ')) {
          break;
        }
        const content = line.content.slice(2).trim();
        if (!content) {
          const nested = this.parseYamlBlock(lines, index + 1, line.indent + 2);
          items.push(nested.value);
          index = nested.nextIndex;
        } else if (content.includes(':')) {
          const colonIndex = content.indexOf(':');
          const key = this.normalizeKey(content.slice(0, colonIndex).trim());
          const remainder = content.slice(colonIndex + 1).trim();
          const entry: Record<string, unknown> = {};
          if (remainder) {
            entry[key] = this.parseScalar(remainder);
          }

          let nextIndex = index + 1;
          if (nextIndex < lines.length && lines[nextIndex].indent > line.indent) {
            const nested = this.parseYamlBlock(lines, nextIndex, line.indent + 2);
            if (nested.value && typeof nested.value === 'object' && !Array.isArray(nested.value)) {
              Object.assign(entry, nested.value as Record<string, unknown>);
            } else if (!remainder) {
              entry[key] = nested.value;
            }
            nextIndex = nested.nextIndex;
          }

          items.push(entry);
          index = nextIndex;
        } else {
          items.push(this.parseScalar(content));
          index += 1;
        }
      }
      return { value: items, nextIndex: index };
    }

    const result: Record<string, unknown> = {};
    let index = startIndex;
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent < currentIndent || line.content.startsWith('- ')) {
        break;
      }
      const colonIndex = line.content.indexOf(':');
      if (colonIndex === -1) {
        throw new Error(`Invalid YAML syntax near "${line.content}". Expected a key-value pair.`);
      }

      const key = this.normalizeKey(line.content.slice(0, colonIndex).trim());
      const remainder = line.content.slice(colonIndex + 1).trim();

      if (remainder) {
        result[key] = this.parseScalar(remainder);
        index += 1;
      } else {
        const nestedIndent = line.indent + 2;
        const nested = this.parseYamlBlock(lines, index + 1, nestedIndent);
        result[key] = nested.value;
        index = nested.nextIndex;
      }
    }

    return { value: result, nextIndex: index };
  }

  private parseScalar(input: string): unknown {
    if (!input) {
      return '';
    }

    const lower = input.toLowerCase();
    if (lower === 'true') {
      return true;
    }
    if (lower === 'false') {
      return false;
    }
    if (lower === 'null' || lower === '~') {
      return null;
    }

    if (/^[+-]?\d+(\.\d+)?$/.test(input)) {
      const num = Number(input);
      if (!Number.isNaN(num)) {
        return num;
      }
    }

    if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
      try {
        if (input.startsWith('"')) {
          return JSON.parse(input);
        }
        return input.slice(1, -1).replace(/''/g, "'");
      } catch {
        return input.slice(1, -1);
      }
    }

    if ((input.startsWith('[') && input.endsWith(']')) || (input.startsWith('{') && input.endsWith('}'))) {
      try {
        return JSON.parse(input);
      } catch {
        return input;
      }
    }

    return input;
  }

  private normalizeKey(key: string): string {
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      return key.slice(1, -1);
    }
    return key;
  }

  private stringifyToYaml(value: unknown, indentLevel: number): string {
    const indent = ' '.repeat(indentLevel);
    if (Array.isArray(value)) {
      if (!value.length) {
        return `${indent}[]`;
      }
      return value
        .map((item) => {
          if (this.isScalar(item)) {
            return `${indent}- ${this.formatScalar(item)}`;
          }
          const nested = this.stringifyToYaml(item, indentLevel + this.yamlIndent);
          return `${indent}-\n${nested}`;
        })
        .join('\n');
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (!entries.length) {
        return `${indent}{}`;
      }
      const builder: string[] = [];
      entries.forEach(([key, val]) => {
        const safeKey = this.formatKey(key);
        if (this.isScalar(val)) {
          builder.push(`${indent}${safeKey}: ${this.formatScalar(val)}`);
        } else {
          const nested = this.stringifyToYaml(val, indentLevel + this.yamlIndent);
          builder.push(`${indent}${safeKey}:\n${nested}`);
        }
      });
      return builder.join('\n');
    }

    return `${indent}${this.formatScalar(value)}`;
  }

  private isScalar(value: unknown): boolean {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private formatScalar(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : `"${value}"`;
    }
    if (typeof value === 'string') {
      if (!value.length) {
        return '""';
      }
      if (!this.yamlQuoteStrings) {
        const simple = /^[A-Za-z0-9_.\- ]+$/.test(value);
        if (simple && !value.includes(':') && !value.includes('- ')) {
          return value;
        }
      }
      const escaped = value.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return JSON.stringify(value);
  }

  private formatKey(key: string): string {
    if (/^[A-Za-z0-9_.-]+$/.test(key)) {
      return key;
    }
    return `"${key.replace(/"/g, '\\"')}"`;
  }

  private sortObject(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortObject(item));
    }
    if (value && typeof value === 'object') {
      const sortedKeys = Object.keys(value as Record<string, unknown>).sort((a, b) =>
        a.localeCompare(b)
      );
      const result: Record<string, unknown> = {};
      sortedKeys.forEach((key) => {
        result[key] = this.sortObject((value as Record<string, unknown>)[key]);
      });
      return result;
    }
    return value;
  }

  private updateMetrics(value: string, selection: string): void {
    const lines = value.split(/\r?\n/).length;
    this.metrics = {
      lines,
      sizeLabel: this.formatBytes(new Blob([value]).size),
      selection
    };
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

  private recordHistory(label: string): void {
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.operationHistory = [{ label, timestamp }, ...this.operationHistory].slice(0, 6);
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
          this.updateMetrics(text, 'YAML');
          this.updateEditorLineNumbers();
          this.conversionStatus = {
            status: 'idle',
            message: `Loaded YAML file (${file.name}). Ready to convert.`
          };
        } else if (isJson || (!isYaml && this.conversionMode === 'json-to-yaml')) {
          this.conversionMode = 'json-to-yaml';
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
            message: `Unsupported file type: ${extension || 'unknown'}. Upload YAML or JSON.`
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

  private loadSample(): void {
    if (this.conversionMode === 'yaml-to-json') {
      this.yamlInput = SAMPLE_YAML;
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
      this.jsonInput = SAMPLE_JSON;
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
    const lines = currentInput.split(/\r?\n/).length;
    this.editorLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }

  private updateResultLineNumbers(): void {
    const lines = this.resultOutput.split(/\r?\n/).length;
    this.resultLines = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }
}
