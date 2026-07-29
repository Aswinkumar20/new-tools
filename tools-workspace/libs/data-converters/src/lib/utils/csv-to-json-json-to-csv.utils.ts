import type { DcToolSuggestion } from '../shared/dc-tool-suggestion.model';
import type {
  ConversionFailure,
  CsvBuildOptions,
  CsvJsonConversionMode,
  CsvJsonHistoryEntry,
  CsvJsonMetricsSummary,
  CsvLineEnding,
  CsvParseOptions,
  CsvParseResult,
  CsvToJsonSuccess,
  JsonToCsvSuccess
} from '../types/csv-to-json-json-to-csv.types';

export function formatCsvJsonBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function buildLineNumberList(text: string): number[] {
  const lines = text.split(/\r?\n/).length;
  return Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
}

export function resolveCsvLineEnding(source: string, option: CsvLineEnding): string {
  if (option === 'lf') {
    return '\n';
  }
  if (option === 'crlf') {
    return '\r\n';
  }
  return source.includes('\r\n') ? '\r\n' : '\n';
}

export function isCsvNewline(source: string, index: number, newline: string): boolean {
  if (newline === '\r\n') {
    return source[index] === '\r' && source[index + 1] === '\n';
  }
  return source[index] === '\n';
}

export function sortObjectKeys(this: void, _key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .forEach((childKey) => {
        sorted[childKey] = (value as Record<string, unknown>)[childKey];
      });
    return sorted;
  }
  return value;
}

export function wrapCsvField(
  value: string,
  delimiter: string,
  quoteChar: string,
  trimWhitespace: boolean
): string {
  const mustQuote =
    value.includes(delimiter) ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.includes(quoteChar);

  let escaped = value;
  if (value.includes(quoteChar)) {
    const regex = new RegExp(quoteChar, 'g');
    escaped = value.replace(regex, quoteChar + quoteChar);
  }

  if (mustQuote) {
    return `${quoteChar}${escaped}${quoteChar}`;
  }
  if (trimWhitespace) {
    return escaped.trim();
  }
  return escaped;
}

export function stringifyCsvValue(
  value: unknown,
  delimiter: string,
  quoteChar: string,
  trimWhitespace: boolean
): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return wrapCsvField(value, delimiter, quoteChar, trimWhitespace);
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return wrapCsvField(String(value), delimiter, quoteChar, trimWhitespace);
  }

  return wrapCsvField(JSON.stringify(value), delimiter, quoteChar, trimWhitespace);
}

export function parseCsv(
  source: string,
  options: CsvParseOptions
): CsvParseResult | { error: string } {
  const delimiter = options.delimiter;
  const quoteChar = options.quote || '"';
  const newline = resolveCsvLineEnding(source, options.lineEnding);

  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let insideQuotes = false;
  let pointer = 0;
  const length = source.length;

  const pushField = () => {
    currentRow.push(options.trim ? currentField.trim() : currentField);
    currentField = '';
  };

  const pushRow = () => {
    if (!(options.skipEmpty && currentRow.every((field) => field === ''))) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  while (pointer < length) {
    const char = source[pointer];
    const next = pointer + 1 < length ? source[pointer + 1] : '';

    if (char === quoteChar) {
      if (insideQuotes && next === quoteChar) {
        currentField += quoteChar;
        pointer += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (!insideQuotes && char === delimiter) {
      pushField();
    } else if (!insideQuotes && isCsvNewline(source, pointer, newline)) {
      pushField();
      pushRow();
      pointer += newline.length - 1;
    } else {
      currentField += char;
    }

    pointer += 1;
  }

  pushField();
  pushRow();

  if (!rows.length) {
    return { error: 'No CSV data detected. Check delimiters or upload a different file.' };
  }

  if (options.hasHeader) {
    const headers = rows.shift() ?? [];
    if (!headers.length) {
      return { error: 'Header row is empty. Disable headers or provide valid column names.' };
    }
    return { headers, rows };
  }

  return { headers: null, rows };
}

export function isArrayOfObjects(value: unknown[]): value is Record<string, unknown>[] {
  return (
    value.length > 0 &&
    value.every(
      (entry) =>
        entry !== null &&
        entry !== undefined &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        entry.constructor === Object
    )
  );
}

export function isArrayOfArrays(value: unknown[]): value is unknown[][] {
  return value.length > 0 && value.every((item) => Array.isArray(item) && item.length > 0);
}

export function buildCsv(
  parsed: unknown[],
  newline: string,
  options: CsvBuildOptions
): { value: string; rows: number; columns: number } | { error: string } {
  const delimiter = options.delimiter;
  const quoteChar = options.quote || '"';
  const includeHeader = options.includeHeader;

  const rows: string[][] = [];
  let columns: string[] = [];

  if (isArrayOfObjects(parsed)) {
    const seen = new Set<string>();
    parsed.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      });
    });

    if (options.sortKeys) {
      columns = [...columns].sort((a, b) => a.localeCompare(b));
    }

    if (!columns.length) {
      return { error: 'Could not determine CSV columns from the JSON objects.' };
    }

    if (includeHeader) {
      rows.push(columns);
    }

    parsed.forEach((entry) => {
      const row = columns.map((column) =>
        stringifyCsvValue(entry[column], delimiter, quoteChar, options.trimWhitespace)
      );
      rows.push(row);
    });

    return {
      value: rows.map((row) => row.join(delimiter)).join(newline),
      rows: includeHeader ? rows.length - 1 : rows.length,
      columns: columns.length
    };
  }

  if (isArrayOfArrays(parsed)) {
    const firstRowLength = parsed[0]?.length ?? 0;
    if (firstRowLength === 0) {
      return { error: 'Arrays cannot be empty. Each array should contain at least one value.' };
    }

    parsed.forEach((rowArray) => {
      const row = rowArray.map((value) =>
        stringifyCsvValue(value, delimiter, quoteChar, options.trimWhitespace)
      );
      rows.push(row);
    });

    const csvValue = rows.map((row) => row.join(delimiter)).join(newline);

    return {
      value: csvValue,
      rows: rows.length,
      columns: Math.max(...rows.map((r) => r.length), 0)
    };
  }

  return {
    error:
      'JSON must be an array of objects (preferred) or an array of arrays to convert into CSV.'
  };
}

export function convertCsvToJson(
  csvInput: string,
  parseOptions: CsvParseOptions,
  prettyPrint: boolean,
  sortKeys: boolean
): CsvToJsonSuccess | ConversionFailure {
  if (!csvInput.trim()) {
    return {
      ok: false,
      message: 'Paste or upload CSV content to convert it into JSON. The input field is empty.'
    };
  }

  const parsed = parseCsv(csvInput, parseOptions);
  if ('error' in parsed) {
    return {
      ok: false,
      message: `CSV Parse Error: ${parsed.error}. Please check your CSV format, delimiter, and quote characters.`
    };
  }

  const { headers, rows } = parsed;
  let json: unknown;
  let metrics: CsvJsonMetricsSummary;

  if (headers) {
    json = rows.map((row) => {
      const entry: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] ?? '';
      });
      return entry;
    });
    metrics = {
      rows: rows.length,
      columns: headers.length,
      sizeLabel: formatCsvJsonBytes(new Blob([JSON.stringify(json)]).size),
      selection: 'JSON'
    };
  } else {
    json = rows;
    metrics = {
      rows: rows.length,
      columns: rows[0]?.length ?? 0,
      sizeLabel: formatCsvJsonBytes(new Blob([JSON.stringify(json)]).size),
      selection: 'JSON'
    };
  }

  const replacer = sortKeys ? sortObjectKeys : undefined;
  const output = JSON.stringify(json, replacer, prettyPrint ? 2 : undefined);

  return {
    ok: true,
    output,
    metrics,
    message: `Converted CSV to JSON (${rows.length} rows).`
  };
}

export function convertJsonToCsv(
  jsonInput: string,
  lineEndingOption: CsvLineEnding,
  buildOptions: CsvBuildOptions
): JsonToCsvSuccess | ConversionFailure {
  if (!jsonInput.trim()) {
    return {
      ok: false,
      message: 'Paste or upload JSON content to convert it into CSV. The input field is empty.'
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonInput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to parse JSON input.';
    return {
      ok: false,
      message: `JSON Parse Error: ${errorMessage}. Please check your JSON syntax and try again.`
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      ok: false,
      message:
        'JSON must be an array of objects or arrays with at least one entry. Empty arrays cannot be converted to CSV.'
    };
  }

  const detectedLineEnding = resolveCsvLineEnding(jsonInput, lineEndingOption);
  const csv = buildCsv(parsed, detectedLineEnding, buildOptions);
  if ('error' in csv) {
    return {
      ok: false,
      message: `CSV Generation Error: ${csv.error}. Please ensure your JSON structure is compatible with CSV format.`
    };
  }

  return {
    ok: true,
    output: csv.value,
    metrics: {
      rows: csv.rows,
      columns: csv.columns,
      sizeLabel: formatCsvJsonBytes(new Blob([csv.value]).size),
      selection: 'CSV'
    },
    message: `Converted JSON to CSV (${csv.rows} rows).`
  };
}

export function computeInputMetrics(
  value: string,
  selection: string,
  mode: CsvJsonConversionMode,
  delimiter: string
): CsvJsonMetricsSummary {
  const rows = value.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  const columns =
    mode === 'csv-to-json'
      ? (value.split(/\r?\n/, 1)[0]?.split(delimiter).length ?? 0)
      : 0;
  return {
    rows,
    columns,
    sizeLabel: formatCsvJsonBytes(new Blob([value]).size),
    selection
  };
}

export function prependCsvJsonHistory(
  entries: CsvJsonHistoryEntry[],
  label: string,
  limit: number,
  now = new Date()
): CsvJsonHistoryEntry[] {
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

export function looksLikeYamlSource(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }
  return /^[\w.-]+\s*:\s*\S/m.test(trimmed) && !/,/.test(trimmed.split('\n')[0] ?? '');
}

export function looksLikeHtmlTableSource(text: string): boolean {
  return /<table[\s>]/i.test(text);
}

export function resolveCsvJsonSuggestion(
  mode: CsvJsonConversionMode,
  input: string,
  status: 'idle' | 'success' | 'error',
  hasResult: boolean
): DcToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-input',
      title: mode === 'csv-to-json' ? 'Paste CSV to convert' : 'Paste JSON to convert',
      reason:
        'Drop tabular data here, or load the sample. For spreadsheet files, try Excel to JSON instead.',
      actionLabel: 'Open Excel to JSON',
      path: '/data-converters/excel-to-json'
    };
  }

  if (looksLikeHtmlTableSource(trimmed)) {
    return {
      id: 'html-table',
      title: 'HTML table detected',
      reason:
        'Markup includes a <table>. HTML Table to JSON or HTML Table Exporter will parse it more accurately.',
      actionLabel: 'Open HTML Table to JSON',
      path: '/data-converters/html-table-to-json'
    };
  }

  if (mode === 'csv-to-json' && looksLikeYamlSource(trimmed)) {
    return {
      id: 'yaml-input',
      title: 'Input looks like YAML',
      reason:
        'Key/value lines without CSV commas suggest YAML. Use YAML ⇄ JSON for configuration files.',
      actionLabel: 'Open YAML ⇄ JSON',
      path: '/data-converters/yaml-to-json-json-to-yaml'
    };
  }

  if (mode === 'csv-to-json' && hasResult && status === 'success') {
    return {
      id: 'json-ready',
      title: 'JSON ready — validate next',
      reason:
        'Pretty-print, lint, or validate the converted JSON before shipping it to an API.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (mode === 'json-to-csv' && hasResult && status === 'success') {
    return {
      id: 'csv-ready',
      title: 'CSV ready for spreadsheets',
      reason:
        'Download and open in Excel, or convert spreadsheet workbooks with Excel to JSON when you need the reverse path.',
      actionLabel: 'Open Excel to JSON',
      path: '/data-converters/excel-to-json'
    };
  }

  return {
    id: 'pair-formatter',
    title: 'Pair with JSON tooling',
    reason:
      'After conversion, JSON Formatter helps catch syntax issues and reformat nested payloads.',
    actionLabel: 'Open JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator'
  };
}
