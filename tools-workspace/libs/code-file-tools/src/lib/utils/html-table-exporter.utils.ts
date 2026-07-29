import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import { HTML_TABLE_EXPORT_META } from '../constants/html-table-exporter.constants';
import type {
  HtmlTableData,
  HtmlTableExportFormat,
  HtmlTableExportResult,
  HtmlTableParseOutcome
} from '../types/html-table-exporter.types';

export function getCellText(cell: Element): string {
  return cell.textContent?.trim() || '';
}

export function extractTableData(table: HTMLTableElement): HtmlTableData {
  const headers: string[] = [];
  const rows: string[][] = [];

  const thead = table.querySelector('thead');
  if (thead) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      const cells = headerRow.querySelectorAll('th, td');
      cells.forEach((cell) => {
        headers.push(getCellText(cell));
      });
    }
  }

  const tbody = table.querySelector('tbody') || table;
  const rowElements = tbody.querySelectorAll('tr');

  rowElements.forEach((row, index) => {
    if (!thead && index === 0 && headers.length === 0) {
      const cells = row.querySelectorAll('th, td');
      cells.forEach((cell) => {
        headers.push(getCellText(cell));
      });
      return;
    }

    const rowData: string[] = [];
    const cells = row.querySelectorAll('td, th');
    cells.forEach((cell) => {
      rowData.push(getCellText(cell));
    });
    if (rowData.length > 0) {
      rows.push(rowData);
    }
  });

  return { headers, rows };
}

export function parseHtmlTable(html: string): HtmlTableParseOutcome {
  const trimmed = html.trim();
  if (!trimmed) {
    return { data: null, error: null };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'text/html');
    const table = doc.querySelector('table');

    if (!table) {
      return {
        data: null,
        error: 'No table found in the HTML. Please provide a valid HTML table.'
      };
    }

    return { data: extractTableData(table), error: null };
  } catch (error) {
    return {
      data: null,
      error: `Failed to parse table: ${(error as Error)?.message ?? 'Unknown error'}`
    };
  }
}

export function escapeCsvRow(row: string[]): string {
  return row
    .map((cell) => {
      if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    })
    .join(',');
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeXmlTag(tag: string): string {
  return tag
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .substring(0, 50);
}

export function exportTableToCsv(data: HtmlTableData, includeHeaders: boolean): string {
  const rows: string[] = [];
  if (includeHeaders && data.headers.length > 0) {
    rows.push(escapeCsvRow(data.headers));
  }
  data.rows.forEach((row) => {
    rows.push(escapeCsvRow(row));
  });
  return rows.join('\n');
}

export function exportTableToTsv(data: HtmlTableData, includeHeaders: boolean): string {
  const rows: string[] = [];
  if (includeHeaders && data.headers.length > 0) {
    rows.push(data.headers.join('\t'));
  }
  data.rows.forEach((row) => {
    rows.push(row.join('\t'));
  });
  return rows.join('\n');
}

export function exportTableToJson(data: HtmlTableData, includeHeaders: boolean): string {
  if (includeHeaders && data.headers.length > 0) {
    const objects = data.rows.map((row) => {
      const obj: Record<string, string> = {};
      data.headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    return JSON.stringify(objects, null, 2);
  }

  const arrays = [data.headers, ...data.rows];
  return JSON.stringify(arrays, null, 2);
}

export function exportTableToXml(data: HtmlTableData, includeHeaders: boolean): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

  data.rows.forEach((row) => {
    xml += '  <row>\n';
    if (includeHeaders && data.headers.length > 0) {
      data.headers.forEach((header, index) => {
        const value = row[index] || '';
        const tagName = sanitizeXmlTag(header || `column${index + 1}`);
        xml += `    <${tagName}>${escapeXml(value)}</${tagName}>\n`;
      });
    } else {
      row.forEach((value, index) => {
        const tagName = `column${index + 1}`;
        xml += `    <${tagName}>${escapeXml(value)}</${tagName}>\n`;
      });
    }
    xml += '  </row>\n';
  });

  xml += '</root>';
  return xml;
}

export function exportTableToMarkdown(data: HtmlTableData, includeHeaders: boolean): string {
  const rows: string[] = [];

  if (includeHeaders && data.headers.length > 0) {
    rows.push('| ' + data.headers.join(' | ') + ' |');
    rows.push('| ' + data.headers.map(() => '---').join(' | ') + ' |');
  }

  data.rows.forEach((row) => {
    rows.push('| ' + row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ') + ' |');
  });

  return rows.join('\n');
}

export function buildTableExportResult(
  data: HtmlTableData,
  format: HtmlTableExportFormat,
  includeHeaders: boolean
): HtmlTableExportResult {
  let content = '';

  switch (format) {
    case 'csv':
      content = exportTableToCsv(data, includeHeaders);
      break;
    case 'tsv':
      content = exportTableToTsv(data, includeHeaders);
      break;
    case 'json':
      content = exportTableToJson(data, includeHeaders);
      break;
    case 'xml':
      content = exportTableToXml(data, includeHeaders);
      break;
    case 'markdown':
      content = exportTableToMarkdown(data, includeHeaders);
      break;
  }

  const meta = HTML_TABLE_EXPORT_META[format];
  return {
    format,
    content,
    filename: meta.filename,
    mimeType: meta.mimeType
  };
}

export function looksLikeCsvSource(text: string): boolean {
  const trimmed = text.trim();
  if (/<table[\s>]/i.test(trimmed)) {
    return false;
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  return lines.length >= 2 && lines.every((line) => line.includes(','));
}

export function resolveHtmlTableExporterSuggestion(
  input: string,
  format: HtmlTableExportFormat,
  hasTableData: boolean,
  parseError: string | null
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-table',
      title: 'Paste an HTML table to export',
      reason:
        'Drop a <table> snippet here, or load the sample. For already-tabular CSV, use CSV ↔ JSON instead.',
      actionLabel: 'Open CSV ↔ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeCsvSource(trimmed)) {
    return {
      id: 'csv-input',
      title: 'Input looks like CSV, not HTML',
      reason:
        'Comma-separated rows were detected without a <table>. Convert CSV with the dedicated CSV ↔ JSON tool.',
      actionLabel: 'Open CSV ↔ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (parseError) {
    return {
      id: 'parse-failed',
      title: 'No HTML table detected',
      reason:
        'Wrap your markup in a <table> element, or try HTML Table to JSON for alternate parsing workflows.',
      actionLabel: 'Open HTML Table to JSON',
      path: '/data-converters/html-table-to-json'
    };
  }

  if (hasTableData && format === 'json') {
    return {
      id: 'json-export',
      title: 'JSON export ready',
      reason:
        'Pretty-print and validate the exported JSON, or round-trip it with CSV ↔ JSON for spreadsheet workflows.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasTableData && format === 'csv') {
    return {
      id: 'csv-export',
      title: 'CSV export ready',
      reason:
        'Convert this CSV to JSON objects, or send tabular data to Tables to PDF for a printable report.',
      actionLabel: 'Open CSV ↔ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (hasTableData && (format === 'markdown' || format === 'xml')) {
    return {
      id: 'print-export',
      title: 'Continue with a printable table',
      reason:
        'Export is ready. Tables to PDF can render structured rows into a shareable document.',
      actionLabel: 'Open Tables to PDF',
      path: '/pdf-tools/tables-to-pdf'
    };
  }

  return {
    id: 'pair-html-json',
    title: 'Try the dedicated table → JSON tool',
    reason:
      'This exporter covers many formats. HTML Table to JSON focuses on clean JSON conversion from markup.',
    actionLabel: 'Open HTML Table to JSON',
    path: '/data-converters/html-table-to-json'
  };
}
