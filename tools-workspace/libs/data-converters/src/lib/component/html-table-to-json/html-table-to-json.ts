import { Component } from '@angular/core';
import { CommonModule, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationComponent } from '@tools-workspace/features-home';

type SelectionMode = 'auto' | 'body' | 'custom';

interface HistoryEntry {
  label: string;
  timestamp: string;
}

interface ConversionStatus {
  status: 'idle' | 'success' | 'error';
  message: string;
}

interface MetricsSummary {
  rows: number;
  columns: number;
  sizeLabel: string;
}

interface TableParseOptions {
  selector?: string;
  headerRows: number;
  trimCells: boolean;
  compactArrays: boolean;
  includeEmptyCells: boolean;
  dateDetection: boolean;
  numberDetection: boolean;
  selectionMode: SelectionMode;
}

interface TableExtraction {
  headers: string[];
  rows: string[][];
}

const SAMPLE_TABLE = `<table>
  <thead>
    <tr>
      <th>id</th>
      <th>name</th>
      <th>email</th>
      <th>active</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Ada Lovelace</td>
      <td>ada@example.com</td>
      <td>true</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Alan Turing</td>
      <td>alan@example.com</td>
      <td>false</td>
    </tr>
  </tbody>
</table>`;

@Component({
  selector: 'lib-html-table-to-json',
  standalone: true,
  templateUrl: './html-table-to-json.html',
  styleUrls: ['./html-table-to-json.scss'],
  imports: [CommonModule, NgIf, NgFor, NgTemplateOutlet, FormsModule, NavigationComponent]
})
export class HtmlTableToJsonComponent {
  readonly selectionModes: Array<{ id: SelectionMode; label: string; description: string }> = [
    {
      id: 'auto',
      label: 'Auto detect',
      description: 'Look for the first <table> element, merging tHead/tBody/tFoot automatically.'
    },
    {
      id: 'body',
      label: 'Use table body',
      description: 'Ignore table headers; treat every row as data.'
    },
    {
      id: 'custom',
      label: 'Custom selector',
      description: 'Target a specific table or section with a CSS selector.'
    }
  ];

  readonly usageSteps = [
    'Paste HTML containing a table or upload an HTML file.',
    'Pick how rows/columns should be detected (auto, body, or a custom selector).',
    'Adjust header rows, trim options, and detection for numbers/dates.',
    'Convert and copy/download the JSON output for analytics or automation.'
  ];

  readonly callouts = [
    {
      title: 'Smart detection',
      detail: 'Auto-detects table headers, footers, merged cells, and row spans when possible.'
    },
    {
      title: 'Custom control',
      detail: 'Use CSS selectors to isolate nested tables or specific table regions.'
    },
    {
      title: 'Ready to share',
      detail: 'Copy to clipboard or download formatted JSON for downstream scripts.'
    }
  ];

  selectionMode: SelectionMode = 'auto';
  customSelector = '';
  headerRows = 1;
  includeEmptyCells = true;
  trimCells = true;
  compactArrays = false;
  detectNumbers = true;
  detectDates = false;

  htmlInput = '';
  resultOutput = '';

  conversionStatus: ConversionStatus = {
    status: 'idle',
    message: 'Load a sample table or paste HTML to begin.'
  };
  metrics: MetricsSummary = { rows: 0, columns: 0, sizeLabel: '0 B' };
  operationHistory: HistoryEntry[] = [];

  copyStatus: 'idle' | 'success' | 'error' = 'idle';
  isDragOver = false;

  constructor() {
    this.loadSample();
  }

  get selectionDescription(): string | undefined {
    return this.selectionModes.find((mode) => mode.id === this.selectionMode)?.description;
  }

  onSelectionModeChange(mode: SelectionMode): void {
    this.selectionMode = mode;
  }

  onHtmlInputChange(value: string): void {
    this.htmlInput = value;
    this.resultOutput = '';
    this.metrics = { rows: 0, columns: 0, sizeLabel: this.formatBytes(new Blob([value]).size) };
    this.conversionStatus = { status: 'idle', message: 'Ready to convert HTML table into JSON.' };
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
    if (!this.htmlInput.trim()) {
      this.conversionStatus = {
        status: 'error',
        message: 'Paste an HTML table snippet or upload a file before converting.'
      };
      return;
    }

    const options: TableParseOptions = {
      selector: this.selectionMode === 'custom' ? this.customSelector : undefined,
      headerRows: this.selectionMode === 'body' ? 0 : Math.max(0, Math.floor(this.headerRows)),
      trimCells: this.trimCells,
      compactArrays: this.compactArrays,
      includeEmptyCells: this.includeEmptyCells,
      dateDetection: this.detectDates,
      numberDetection: this.detectNumbers,
      selectionMode: this.selectionMode
    };

    try {
      const extraction = this.extractTable(this.htmlInput, options);
      const data = this.buildJson(extraction, options);
      this.resultOutput = JSON.stringify(data, null, 2);
      this.metrics = {
        rows: extraction.rows.length,
        columns: extraction.headers.length || (extraction.rows[0]?.length ?? 0),
        sizeLabel: this.formatBytes(new Blob([this.resultOutput]).size)
      };
      this.conversionStatus = {
        status: 'success',
        message: `Converted table with ${extraction.rows.length} rows and ${this.metrics.columns} columns.`
      };
      this.recordHistory('Converted HTML table to JSON');
    } catch (error) {
      this.conversionStatus = {
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to parse the provided HTML table. Check the structure and try again.'
      };
      this.resultOutput = '';
    }
  }

  resetWorkspace(): void {
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
      this.recordHistory('Copied JSON result');
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
    link.download = `table-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.recordHistory('Downloaded JSON result');
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

  private extractTable(html: string, options: TableParseOptions): TableExtraction {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let table: HTMLTableElement | null = null;
    if (options.selector) {
      table = doc.querySelector<HTMLTableElement>(options.selector);
      if (!table) {
        throw new Error(`No table found for selector "${options.selector}".`);
      }
    } else {
      table = doc.querySelector<HTMLTableElement>('table');
      if (!table) {
        throw new Error('No table element found. Make sure the HTML contains a <table>.');
      }
    }

    const initialHeaders = this.collectHeaderRows(table, options);
    const { dataRows, additionalHeaders } = this.collectDataRows(
      table,
      options,
      initialHeaders.length
    );
    const allHeaderRows = [...initialHeaders, ...additionalHeaders];

    const headers = this.extractHeaderValues(allHeaderRows, options);
    const bodyRows = dataRows.map((row) => this.extractCellValues(row, options));

    return { headers, rows: bodyRows };
  }

  private collectHeaderRows(
    table: HTMLTableElement,
    options: TableParseOptions
  ): HTMLTableRowElement[] {
    if (options.headerRows <= 0) {
      return [];
    }
    const head = table.tHead;
    if (!head) {
      return [];
    }

    const headerRows: HTMLTableRowElement[] = [];
    const limit = Math.min(options.headerRows, head.rows.length);
    for (let index = 0; index < limit; index += 1) {
      const row = head.rows.item(index);
      if (row) {
        headerRows.push(row);
      }
    }
    return headerRows;
  }

  private collectDataRows(
    table: HTMLTableElement,
    options: TableParseOptions,
    existingHeaderCount: number
  ): { dataRows: HTMLTableRowElement[]; additionalHeaders: HTMLTableRowElement[] } {
    const collectedRows: HTMLTableRowElement[] = [];
    const pushRows = (collection: HTMLCollectionOf<HTMLTableRowElement>) => {
      for (const row of Array.from(collection)) {
        collectedRows.push(row);
      }
    };

    if (options.selectionMode === 'body' || options.headerRows === 0) {
      if (table.tBodies.length) {
        for (const body of Array.from(table.tBodies)) {
          pushRows(body.rows);
        }
      } else {
        pushRows(table.rows);
      }
    } else {
      pushRows(table.rows);
    }

    const remainingHeaderSlots = Math.max(
      0,
      Math.min(options.headerRows, collectedRows.length) - existingHeaderCount
    );
    const additionalHeaders = collectedRows.splice(0, remainingHeaderSlots);

    return { dataRows: collectedRows, additionalHeaders };
  }

  private extractHeaderValues(rows: HTMLTableRowElement[], options: TableParseOptions): string[] {
    if (!rows.length) {
      return [];
    }

    const headerCells: string[] = [];
    for (const row of rows) {
      const cells = Array.from(row.cells);
      for (const [index, cell] of cells.entries()) {
        const value = this.cleanCellText(cell.textContent ?? '', options.trimCells);
        const resolvedHeader = value.length > 0 ? value : `column_${index + 1}`;
        headerCells[index] = headerCells[index] ?? resolvedHeader;
      }
    }

    return headerCells;
  }

  private extractCellValues(row: HTMLTableRowElement, options: TableParseOptions): string[] {
    const cells = Array.from(row.cells);
    if (!cells.length) {
      return [];
    }
    return cells.map((cell, index) => {
      let text = this.cleanCellText(cell.textContent ?? '', options.trimCells);
      if (!options.includeEmptyCells && !text.length) {
        text = '';
      }
      if (options.numberDetection) {
        const numericValue = this.parseNumber(text);
        if (numericValue !== null) {
          return numericValue as unknown as string;
        }
      }
      if (options.dateDetection) {
        const date = this.parseDate(text);
        if (date) {
          return date;
        }
      }
      return text;
    });
  }

  private buildJson(extraction: TableExtraction, options: TableParseOptions): unknown {
    if (options.compactArrays && !extraction.headers.length) {
      return extraction.rows;
    }

    const headers =
      extraction.headers.length > 0
        ? extraction.headers
        : extraction.rows[0]?.map((_, index) => `column_${index + 1}`) ?? [];

    const data = extraction.rows.map((row) => {
      const entry: Record<string, unknown> = {};
      for (const [index, header] of headers.entries()) {
        entry[header] = row[index] ?? '';
      }
      return entry;
    });

    return data;
  }

  private cleanCellText(text: string, trim: boolean): string {
    const normalized = text.split(/\s+/).join(' ');
    return trim ? normalized.trim() : normalized;
  }

  private parseNumber(value: string): number | null {
    if (!value) {
      return null;
    }
    const normalized = value.split(',').join('');
    if (/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
      const result = Number(normalized);
      return Number.isNaN(result) ? null : result;
    }
    return null;
  }

  private parseDate(value: string): string | null {
    if (!value) {
      return null;
    }
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
    return null;
  }

  private readFile(file: File): void {
    if (!file.type.includes('html') && !file.name.toLowerCase().endsWith('.html')) {
      this.conversionStatus = {
        status: 'error',
        message: 'Only HTML files are supported for table conversion.'
      };
      return;
    }

    file
      .text()
      .then((text) => {
        this.htmlInput = text;
        this.conversionStatus = {
          status: 'idle',
          message: `Loaded HTML file (${file.name}). Configure options and convert when ready.`
        };
        this.metrics = { rows: 0, columns: 0, sizeLabel: this.formatBytes(text.length) };
      })
      .catch(() => {
        this.conversionStatus = {
          status: 'error',
          message: 'Could not read the selected file. Please try another HTML file.'
        };
      });
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

  private loadSample(): void {
    this.htmlInput = SAMPLE_TABLE;
    this.resultOutput = '';
    this.metrics = { rows: 0, columns: 0, sizeLabel: this.formatBytes(this.htmlInput.length) };
    this.conversionStatus = {
      status: 'idle',
      message: 'Sample HTML table loaded. Adjust options and convert when ready.'
    };
    this.operationHistory = [];
    this.copyStatus = 'idle';
  }
}
