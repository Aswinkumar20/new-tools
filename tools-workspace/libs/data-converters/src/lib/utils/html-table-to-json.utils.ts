import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import type {
  HtmlTableConvertFailure,
  HtmlTableConvertSuccess,
  HtmlTableExtraction,
  HtmlTableHistoryEntry,
  HtmlTableParseOptions,
  HtmlTableSelectionMode
} from '../types/html-table-to-json.types';
import {
  buildLineNumberList,
  formatCsvJsonBytes
} from './csv-to-json-json-to-csv.utils';

export { buildLineNumberList, formatCsvJsonBytes as formatHtmlTableBytes };

export function prependHtmlTableHistory(
  entries: HtmlTableHistoryEntry[],
  label: string,
  limit: number,
  now = new Date()
): HtmlTableHistoryEntry[] {
  const timestamp = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return [{ label, timestamp }, ...entries].slice(0, limit);
}

export function blurActiveElement(): void {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function cleanHtmlTableCellText(text: string, trim: boolean): string {
  const normalized = text.split(/\s+/).join(' ');
  return trim ? normalized.trim() : normalized;
}

export function parseHtmlTableNumber(value: string): number | null {
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

export function parseHtmlTableDate(value: string): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toISOString();
  }
  return null;
}

export function collectHtmlTableHeaderRows(
  table: HTMLTableElement,
  options: HtmlTableParseOptions
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

export function collectHtmlTableDataRows(
  table: HTMLTableElement,
  options: HtmlTableParseOptions,
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

export function extractHtmlTableHeaderValues(
  rows: HTMLTableRowElement[],
  options: HtmlTableParseOptions
): string[] {
  if (!rows.length) {
    return [];
  }

  const headerCells: string[] = [];
  for (const row of rows) {
    const cells = Array.from(row.cells);
    for (const [index, cell] of cells.entries()) {
      const value = cleanHtmlTableCellText(cell.textContent ?? '', options.trimCells);
      const resolvedHeader = value.length > 0 ? value : `column_${index + 1}`;
      headerCells[index] = headerCells[index] ?? resolvedHeader;
    }
  }

  return headerCells;
}

export function extractHtmlTableCellValues(
  row: HTMLTableRowElement,
  options: HtmlTableParseOptions
): string[] {
  const cells = Array.from(row.cells);
  if (!cells.length) {
    return [];
  }
  return cells.map((cell) => {
    let text = cleanHtmlTableCellText(cell.textContent ?? '', options.trimCells);

    if (!options.includeEmptyCells && !text.length) {
      return '';
    }

    if (options.numberDetection && text.length > 0) {
      const numericValue = parseHtmlTableNumber(text);
      if (numericValue !== null) {
        return numericValue as unknown as string;
      }
    }

    if (options.dateDetection && text.length > 0) {
      const date = parseHtmlTableDate(text);
      if (date) {
        return date;
      }
    }

    return text || '';
  });
}

export function buildHtmlTableJson(
  extraction: HtmlTableExtraction,
  options: HtmlTableParseOptions
): unknown {
  if (options.compactArrays && !extraction.headers.length) {
    return extraction.rows;
  }

  const headers =
    extraction.headers.length > 0
      ? extraction.headers
      : extraction.rows[0]?.map((_, index) => `column_${index + 1}`) ?? [];

  return extraction.rows.map((row) => {
    const entry: Record<string, unknown> = {};
    for (const [index, header] of headers.entries()) {
      entry[header] = row[index] ?? '';
    }
    return entry;
  });
}

export function extractHtmlTable(
  html: string,
  options: HtmlTableParseOptions
): HtmlTableExtraction {
  if (!html || !html.trim()) {
    throw new Error('HTML input is empty. Please provide HTML content containing a table.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(
      'Invalid HTML format. The HTML could not be parsed. Please check your HTML syntax.'
    );
  }

  let table: HTMLTableElement | null = null;
  if (options.selector) {
    if (!options.selector.trim()) {
      throw new Error('Custom selector cannot be empty. Please provide a valid CSS selector.');
    }
    try {
      table = doc.querySelector<HTMLTableElement>(options.selector);
    } catch {
      throw new Error(
        `Invalid CSS selector: "${options.selector}". Please use a valid selector (e.g., ".class", "#id", "table").`
      );
    }
    if (!table) {
      throw new Error(
        `No table found for selector "${options.selector}". Please verify the selector matches a table in your HTML.`
      );
    }
  } else {
    table = doc.querySelector<HTMLTableElement>('table');
    if (!table) {
      throw new Error(
        'No table element found. Make sure the HTML contains a <table> tag. If using a custom table, try custom selector mode.'
      );
    }
  }

  const initialHeaders = collectHtmlTableHeaderRows(table, options);
  const { dataRows, additionalHeaders } = collectHtmlTableDataRows(
    table,
    options,
    initialHeaders.length
  );
  const allHeaderRows = [...initialHeaders, ...additionalHeaders];

  if (dataRows.length === 0) {
    throw new Error(
      'No data rows found in the table. Please ensure the table contains <tr> elements with data cells.'
    );
  }

  const headers = extractHtmlTableHeaderValues(allHeaderRows, options);
  const bodyRows = dataRows.map((row) => extractHtmlTableCellValues(row, options));

  if (bodyRows.length === 0) {
    throw new Error(
      'No valid data rows extracted from the table. Please check your table structure and options.'
    );
  }

  return { headers, rows: bodyRows };
}

export function convertHtmlTableToJson(
  htmlInput: string,
  selectionMode: HtmlTableSelectionMode,
  customSelector: string,
  headerRows: number,
  trimCells: boolean,
  compactArrays: boolean,
  includeEmptyCells: boolean,
  detectDates: boolean,
  detectNumbers: boolean
): HtmlTableConvertSuccess | HtmlTableConvertFailure {
  if (!htmlInput.trim()) {
    return {
      ok: false,
      message:
        'Paste an HTML table snippet or upload a file before converting. The input field is empty.'
    };
  }

  if (selectionMode === 'custom' && !customSelector.trim()) {
    return {
      ok: false,
      message:
        'Custom selector mode requires a CSS selector. Please provide a selector (e.g., ".table-class" or "#table-id").'
    };
  }

  const options: HtmlTableParseOptions = {
    selector: selectionMode === 'custom' ? customSelector : undefined,
    headerRows: selectionMode === 'body' ? 0 : Math.max(0, Math.floor(headerRows)),
    trimCells,
    compactArrays,
    includeEmptyCells,
    dateDetection: detectDates,
    numberDetection: detectNumbers,
    selectionMode
  };

  try {
    const extraction = extractHtmlTable(htmlInput, options);

    if (!extraction.rows.length) {
      return {
        ok: false,
        message:
          'No table rows found. Please ensure your HTML contains valid table rows with data.'
      };
    }

    const data = buildHtmlTableJson(extraction, options);
    const output = JSON.stringify(data, null, 2);
    const columns = extraction.headers.length || (extraction.rows[0]?.length ?? 0);

    return {
      ok: true,
      output,
      metrics: {
        rows: extraction.rows.length,
        columns,
        sizeLabel: formatCsvJsonBytes(new Blob([output]).size)
      },
      message: `Converted table with ${extraction.rows.length} rows and ${columns} columns.`
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unable to parse the provided HTML table. Check the structure and try again.';
    return {
      ok: false,
      message: `HTML Parse Error: ${errorMessage}. Please check your HTML structure, table tags, and selector (if using custom mode).`
    };
  }
}

export function looksLikeCsvSource(text: string): boolean {
  const trimmed = text.trim();
  if (/<table[\s>]/i.test(trimmed)) {
    return false;
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  return lines.length >= 2 && lines.every((line) => line.includes(','));
}

export function resolveHtmlTableToJsonSuggestion(
  input: string,
  hasResult: boolean,
  status: 'idle' | 'success' | 'error'
): DcToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-html',
      title: 'Paste an HTML table to convert',
      reason:
        'Drop a <table> snippet here, or load the sample. For CSV text, use CSV ⇄ JSON instead.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (looksLikeCsvSource(trimmed)) {
    return {
      id: 'csv-input',
      title: 'Input looks like CSV, not HTML',
      reason:
        'Comma-separated rows were detected without a <table>. Convert CSV with the dedicated CSV ⇄ JSON tool.',
      actionLabel: 'Open CSV ⇄ JSON',
      path: '/data-converters/csv-to-json-json-to-csv'
    };
  }

  if (hasResult && status === 'success') {
    return {
      id: 'json-ready',
      title: 'JSON ready — next steps',
      reason:
        'Pretty-print the result, export other formats with HTML Table Exporter, or round-trip via CSV ⇄ JSON.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return {
    id: 'pair-exporter',
    title: 'Need CSV or Markdown too?',
    reason:
      'HTML Table Exporter can turn the same markup into CSV, TSV, XML, or Markdown in one place.',
    actionLabel: 'Open HTML Table Exporter',
    path: '/code-file-tools/html-table-exporter'
  };
}
