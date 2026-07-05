import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface TableData {
  headers: string[];
  rows: string[][];
}

interface ExportResult {
  format: string;
  content: string;
  filename: string;
  mimeType: string;
}

const SAMPLE_TABLE = `<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>John Doe</td>
      <td>john@example.com</td>
      <td>Active</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Jane Smith</td>
      <td>jane@example.com</td>
      <td>Inactive</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Bob Johnson</td>
      <td>bob@example.com</td>
      <td>Active</td>
    </tr>
  </tbody>
</table>`;

@Component({
  selector: 'lib-html-table-exporter',
  standalone: true,
  templateUrl: './html-table-exporter.html',
  styleUrls: ['./html-table-exporter.scss'],
  imports: [CommonModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HtmlTableExporterComponent {
  readonly assetService = inject(AssetService);

  readonly htmlInput = signal<string>(SAMPLE_TABLE);
  readonly exportFormat = signal<'csv' | 'json' | 'tsv' | 'xml' | 'markdown'>('csv');
  readonly includeHeaders = signal<boolean>(true);
  readonly errors = signal<string[]>([]);
  readonly tableData = signal<TableData | null>(null);
  readonly exportResult = signal<ExportResult | null>(null);

  readonly hasTableData = computed(() => this.tableData() !== null);
  readonly hasExportResult = computed(() => this.exportResult() !== null);
  readonly rowCount = computed(() => this.tableData()?.rows.length ?? 0);
  readonly columnCount = computed(() => this.tableData()?.headers.length ?? 0);

  constructor() {
    // Initial parse
    this.parseTable();
  }

  onInputChange(value: string): void {
    this.htmlInput.set(value);
    this.parseTable();
  }

  onFormatChange(format: 'csv' | 'json' | 'tsv' | 'xml' | 'markdown'): void {
    this.exportFormat.set(format);
    this.export();
  }

  parseTable(): void {
    this.errors.set([]);
    this.tableData.set(null);
    this.exportResult.set(null);

    const html = this.htmlInput().trim();
    if (!html) {
      return;
    }

    try {
      // Create a temporary DOM element to parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table');

      if (!table) {
        this.errors.set(['No table found in the HTML. Please provide a valid HTML table.']);
        return;
      }

      const data = this.extractTableData(table);
      this.tableData.set(data);
      this.export();
    } catch (error) {
      this.errors.set([`Failed to parse table: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  private extractTableData(table: HTMLTableElement): TableData {
    const headers: string[] = [];
    const rows: string[][] = [];

    // Extract headers from thead or first row
    const thead = table.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        const cells = headerRow.querySelectorAll('th, td');
        cells.forEach((cell) => {
          headers.push(this.getCellText(cell));
        });
      }
    }

    // Extract rows from tbody or all rows
    const tbody = table.querySelector('tbody') || table;
    const rowElements = tbody.querySelectorAll('tr');

    rowElements.forEach((row, index) => {
      // Skip header row if it's in tbody
      if (!thead && index === 0 && headers.length === 0) {
        const cells = row.querySelectorAll('th, td');
        cells.forEach((cell) => {
          headers.push(this.getCellText(cell));
        });
        return;
      }

      const rowData: string[] = [];
      const cells = row.querySelectorAll('td, th');
      cells.forEach((cell) => {
        rowData.push(this.getCellText(cell));
      });
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    });

    return { headers, rows };
  }

  private getCellText(cell: Element): string {
    return cell.textContent?.trim() || '';
  }

  export(): void {
    const data = this.tableData();
    if (!data) {
      return;
    }

    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      switch (this.exportFormat()) {
        case 'csv':
          content = this.exportToCsv(data);
          filename = 'table.csv';
          mimeType = 'text/csv';
          break;
        case 'tsv':
          content = this.exportToTsv(data);
          filename = 'table.tsv';
          mimeType = 'text/tab-separated-values';
          break;
        case 'json':
          content = this.exportToJson(data);
          filename = 'table.json';
          mimeType = 'application/json';
          break;
        case 'xml':
          content = this.exportToXml(data);
          filename = 'table.xml';
          mimeType = 'application/xml';
          break;
        case 'markdown':
          content = this.exportToMarkdown(data);
          filename = 'table.md';
          mimeType = 'text/markdown';
          break;
      }

      this.exportResult.set({
        format: this.exportFormat(),
        content,
        filename,
        mimeType
      });
    } catch (error) {
      this.errors.set([`Export failed: ${(error as Error)?.message ?? 'Unknown error'}`]);
    }
  }

  private exportToCsv(data: TableData): string {
    const rows: string[] = [];

    if (this.includeHeaders() && data.headers.length > 0) {
      rows.push(this.escapeCsvRow(data.headers));
    }

    data.rows.forEach((row) => {
      rows.push(this.escapeCsvRow(row));
    });

    return rows.join('\n');
  }

  private exportToTsv(data: TableData): string {
    const rows: string[] = [];

    if (this.includeHeaders() && data.headers.length > 0) {
      rows.push(data.headers.join('\t'));
    }

    data.rows.forEach((row) => {
      rows.push(row.join('\t'));
    });

    return rows.join('\n');
  }

  private exportToJson(data: TableData): string {
    if (this.includeHeaders() && data.headers.length > 0) {
      // Export as array of objects
      const objects = data.rows.map((row) => {
        const obj: { [key: string]: string } = {};
        data.headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
      return JSON.stringify(objects, null, 2);
    } else {
      // Export as array of arrays
      const arrays = [data.headers, ...data.rows];
      return JSON.stringify(arrays, null, 2);
    }
  }

  private exportToXml(data: TableData): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

    data.rows.forEach((row) => {
      xml += '  <row>\n';
      if (this.includeHeaders() && data.headers.length > 0) {
        data.headers.forEach((header, index) => {
          const value = row[index] || '';
          const tagName = this.sanitizeXmlTag(header || `column${index + 1}`);
          xml += `    <${tagName}>${this.escapeXml(value)}</${tagName}>\n`;
        });
      } else {
        row.forEach((value, index) => {
          const tagName = `column${index + 1}`;
          xml += `    <${tagName}>${this.escapeXml(value)}</${tagName}>\n`;
        });
      }
      xml += '  </row>\n';
    });

    xml += '</root>';
    return xml;
  }

  private exportToMarkdown(data: TableData): string {
    const rows: string[] = [];

    if (this.includeHeaders() && data.headers.length > 0) {
      rows.push('| ' + data.headers.join(' | ') + ' |');
      rows.push('| ' + data.headers.map(() => '---').join(' | ') + ' |');
    }

    data.rows.forEach((row) => {
      rows.push('| ' + row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ') + ' |');
    });

    return rows.join('\n');
  }

  private escapeCsvRow(row: string[]): string {
    return row
      .map((cell) => {
        // Escape quotes and wrap in quotes if needed
        if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
      .join(',');
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private sanitizeXmlTag(tag: string): string {
    // Remove invalid XML tag characters
    return tag
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .substring(0, 50);
  }

  copyInput(): void {
    this.copyToClipboard(this.htmlInput(), 'Input');
  }

  copyOutput(): void {
    const result = this.exportResult();
    if (result) {
      this.copyToClipboard(result.content, 'Output');
    }
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success
      })
      .catch(() => {
        this.errors.set([`Unable to copy ${label} to clipboard.`]);
      });
  }

  downloadExport(): void {
    const result = this.exportResult();
    if (!result) {
      return;
    }

    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadSample(): void {
    this.htmlInput.set(SAMPLE_TABLE);
    this.parseTable();
  }

  clear(): void {
    this.htmlInput.set('');
    this.tableData.set(null);
    this.exportResult.set(null);
    this.errors.set([]);
  }

  formatBytes(value: number): string {
    if (value === 0) {
      return '0 B';
    }
    const UNITS = ['B', 'KB', 'MB'];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
  }

  getExportSize(content: string): string {
    const size = new Blob([content]).size;
    return this.formatBytes(size);
  }
}
