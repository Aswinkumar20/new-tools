import type { CvColumn, CvDataset, CvSourceKind } from '../types/csv-viewer.types';
import { CV_CSV_SAMPLE } from '../constants/csv-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function cell(value: unknown): string {
  return value == null ? '' : String(value);
}

function detectLineEnding(text: string): string {
  if (text.includes('\r\n')) return 'CRLF';
  if (text.includes('\r')) return 'CR';
  return 'LF';
}

function delimiterLabel(delimiter: string): string {
  if (delimiter === '\t') return 'tab';
  if (delimiter === ';') return ';';
  if (delimiter === '|') return '|';
  return ',';
}

function parseDelimitedRecords(text: string, delimiter: string, quote = '"'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === quote) {
        if (text[i + 1] === quote) {
          cur += quote;
          i += 1;
        } else inQ = false;
      } else cur += ch;
      continue;
    }
    if (ch === quote) {
      inQ = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cur);
      cur = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    if (ch === '\r') continue;
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function scoreDelimiter(text: string, delimiter: string): number {
  const rows = parseDelimitedRecords(text.slice(0, 8192), delimiter).filter((r) => r.some((c) => c.trim()));
  if (rows.length < 1) return -1;
  const widths = rows.slice(0, 24).map((r) => r.length);
  const maxW = Math.max(...widths);
  if (maxW < 2) return -1;
  const counts = new Map<number, number>();
  for (const w of widths) counts.set(w, (counts.get(w) || 0) + 1);
  let mode = widths[0];
  let modeN = 0;
  for (const [w, n] of counts) {
    if (n > modeN) {
      mode = w;
      modeN = n;
    }
  }
  return mode * (modeN / widths.length);
}

function detectCsvDelimiter(text: string, ext: string): { delimiter: string; warning?: string } {
  const sample = text.slice(0, 8192);
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '|']) {
    const score = scoreDelimiter(sample, d);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  if (ext === 'csv' && bestScore < 2) return { delimiter: ',' };
  if (bestScore >= 2) return { delimiter: best, warning: best === ',' ? undefined : `Delimiter detected as ${delimiterLabel(best)}` };
  if (ext === 'txt' || !ext) {
    const tabScore = scoreDelimiter(sample, '\t');
    if (tabScore > bestScore && tabScore >= 2) {
      return { delimiter: '\t', warning: 'Tab delimiter detected — try TSV Viewer for tab-separated files' };
    }
  }
  return { delimiter: ',' };
}

function looksLikeHeader(cells: string[]): boolean {
  if (!cells.length) return false;
  let headerish = 0;
  for (const c of cells) {
    const t = c.trim();
    if (!t) return false;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) continue;
    if (/^[A-Za-z_][\w.\s-]*$/.test(t)) headerish += 1;
  }
  return headerish >= Math.ceil(cells.length / 2);
}

function inferType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'TEXT';
  if (nonEmpty.every((v) => /^(true|false|yes|no)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+$/.test(v))) return 'INTEGER';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'REAL';
  if (nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'DATE';
  return 'TEXT';
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw, i) => {
    const base = raw.trim() || `column${i + 1}`;
    const n = (seen.get(base.toLowerCase()) || 0) + 1;
    seen.set(base.toLowerCase(), n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

function buildColumns(names: string[], rows: Array<Record<string, string>>): CvColumn[] {
  return names.map((name, index) => {
    const values = rows.map((r) => r[name] ?? '');
    const nonEmpty = values.filter((v) => v.trim() !== '');
    const unique = new Set(nonEmpty);
    const type = inferType(values);
    let min = '';
    let max = '';
    if (nonEmpty.length && (type === 'INTEGER' || type === 'REAL' || type === 'DATE' || type === 'TEXT')) {
      const sorted = [...nonEmpty].sort((a, b) => {
        if (type === 'INTEGER' || type === 'REAL') return Number(a) - Number(b);
        return a.localeCompare(b);
      });
      min = sorted[0];
      max = sorted[sorted.length - 1];
    }
    return {
      id: name,
      index,
      name,
      type,
      nullable: nonEmpty.length !== values.length,
      nullCount: values.length - nonEmpty.length,
      uniqueCount: unique.size,
      min,
      max,
      sample: nonEmpty.slice(0, 3).join(', ')
    };
  });
}

function finishDataset(
  name: string,
  sourceKind: CvSourceKind,
  title: string,
  delimiter: string,
  quote: string,
  hasHeader: boolean,
  encoding: string,
  lineEnding: string,
  columns: CvColumn[],
  rows: Array<Record<string, string>>,
  warnings: string[]
): CvDataset {
  if (!columns.length) throw new Error('CSV contains no columns');
  columns.forEach((c, i) => {
    c.index = i;
    c.id = c.name;
  });
  return {
    name,
    sourceKind,
    title: title || name,
    delimiter,
    quote,
    hasHeader,
    encoding,
    lineEnding,
    numRows: rows.length,
    columns,
    rows,
    warnings
  };
}

function recordsToTable(
  records: string[][],
  fileName: string,
  sourceKind: CvSourceKind,
  delimiter: string,
  lineEnding: string,
  warnings: string[],
  hasHeaderHint?: boolean
): CvDataset {
  const nonempty = records.filter((r) => r.some((c) => String(c).trim() !== ''));
  const skipped = records.length - nonempty.length;
  if (skipped) warnings.push(`Skipped ${skipped} empty row(s)`);
  if (nonempty.length < 2) throw new Error('CSV contains no rows');
  const headerRow = nonempty[0].map((c) => c.trim());
  const hasHeader = hasHeaderHint ?? looksLikeHeader(headerRow);
  if (!hasHeader) warnings.push('No header row detected — generated column names');
  const names = uniqueNames(hasHeader ? headerRow.map((h, i) => h || `column${i + 1}`) : headerRow.map((_, i) => `column${i + 1}`));
  const dataRows = hasHeader ? nonempty.slice(1) : nonempty;
  const width = names.length;
  let ragged = 0;
  const rows: Array<Record<string, string>> = [];
  for (const parts of dataRows) {
    if (parts.length !== width) ragged += 1;
    const row: Record<string, string> = {};
    names.forEach((n, i) => (row[n] = parts[i] ?? ''));
    rows.push(row);
  }
  if (ragged) warnings.push(`${ragged} row(s) have a different column count than the header`);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'CSV table';
  return finishDataset(fromFile, sourceKind, fromFile, delimiter, '"', hasHeader, 'UTF-8', lineEnding, buildColumns(names, rows), rows, warnings);
}

function ingestColumn(raw: unknown, index: number): CvColumn | null {
  const row = rec(raw);
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return null;
  return {
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'TEXT').toUpperCase(),
    nullable: row.nullable !== false,
    nullCount: Number(row.nullCount || row.nulls || 0) || 0,
    uniqueCount: Number(row.uniqueCount || row.distinct || 0) || 0,
    min: asString(row.min),
    max: asString(row.max),
    sample: asString(row.sample)
  };
}

function parseJson(raw: unknown, fileName: string): CvDataset {
  const root = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(root.name || root.title || root.table, fileName.replace(/\.[^.]+$/, '') || 'CSV table');
  const delimiterRaw = asString(root.delimiter, ',');
  const delimiter = delimiterRaw === '\\t' || delimiterRaw === 'tab' ? '\t' : delimiterRaw || ',';
  const quote = asString(root.quote, '"') || '"';
  const hasHeader = root.hasHeader !== false;
  let columns: CvColumn[] = [];
  const schemaList = Array.isArray(root.columns) ? root.columns : Array.isArray(root.schema) ? root.schema : [];
  schemaList.forEach((item, i) => {
    const col = ingestColumn(item, i);
    if (col) columns.push(col);
  });
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : Array.isArray(raw) ? raw : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => {
      const col = ingestColumn({ name: key, type: 'TEXT' }, i);
      if (col) columns.push(col);
    });
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) throw new Error('CSV JSON contains no columns');
  const enriched = buildColumns(columns.map((c) => c.name), rows);
  enriched.forEach((c, i) => {
    if (columns[i]?.type && columns[i].type !== 'TEXT') c.type = columns[i].type;
  });
  return finishDataset(
    name,
    'json',
    asString(root.title || root.name, name),
    delimiter,
    quote,
    hasHeader,
    asString(root.encoding, 'UTF-8'),
    asString(root.lineEnding, 'LF'),
    enriched,
    rows,
    []
  );
}

function parseMarkdown(text: string, fileName: string, sourceKind: CvSourceKind): CvDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'CSV table').trim();
  const names: string[] = [];
  const types: string[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      names.push(schema[1]);
      types.push(schema[2].toUpperCase());
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!names.length) {
        parts.forEach((p) => names.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      names.forEach((n, i) => (row[n] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!names.length) throw new Error('CSV markdown contains no schema');
  const columns = buildColumns(names, rows);
  columns.forEach((c, i) => {
    if (types[i]) c.type = types[i];
  });
  return finishDataset(name, sourceKind, name, ',', '"', true, 'UTF-8', detectLineEnding(text), columns, rows, []);
}

function parseCsvDelimited(text: string, fileName: string, sourceKind: CvSourceKind): CvDataset {
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  const warnings: string[] = [];
  const detected = detectCsvDelimiter(text, ext);
  if (detected.warning) warnings.push(detected.warning);
  const records = parseDelimitedRecords(text, detected.delimiter);
  return recordsToTable(records, fileName, sourceKind, detected.delimiter, detectLineEnding(text), warnings);
}

export function buildSampleCsvBytes(): Uint8Array {
  return te.encode(CV_CSV_SAMPLE);
}

export function parseCsvText(text: string, fileName = ''): CvDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('CSV file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid CSV JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  if (ext === 'csv' || ext === 'txt' || /^[\w."';|+-]+[,;|][\w."';|+-]/.test(raw.split(/\r?\n/)[0] || '')) {
    return parseCsvDelimited(raw, fileName, ext === 'txt' ? 'txt' : 'csv');
  }
  if (raw.includes(',') || raw.includes(';') || raw.includes('|')) return parseCsvDelimited(raw, fileName, 'txt');
  throw new Error('Not a CSV dump');
}

export function parseCsvBytes(bytes: Uint8Array, fileName = ''): CvDataset {
  if (!bytes.length) throw new Error('CSV file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed CSV files are not supported — decompress first');
  return parseCsvText(td.decode(bytes), fileName);
}

export function filterCvColumns(columns: CvColumn[], query: string): CvColumn[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  const tokens = q.split(/\s+/).filter(Boolean);
  return columns.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('col:') || token.startsWith('name:')) return c.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('row:') || token.startsWith('empty:') || token.startsWith('null:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.type} ${c.sample}`.toLowerCase().includes(token);
    })
  );
}

export function filterCvRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:')) return Object.values(row).some((v) => v.toLowerCase().includes(token.slice(4)));
      if (token.startsWith('empty:') || token.startsWith('null:')) {
        const key = token.slice(token.indexOf(':') + 1);
        if (!key) return Object.values(row).some((v) => !v);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key);
        return hit ? !String(hit[1]).trim() : false;
      }
      if (token.startsWith('col:') || token.startsWith('name:') || token.startsWith('type:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(row).some((v) => v.toLowerCase().includes(token));
    })
  );
}
