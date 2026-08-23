import type { DkColumn, DkDataset, DkSourceKind, DkTable } from '../types/duckdb-viewer.types';
import {
  DK_ORDER_ROWS,
  DK_ORDERS_SQL,
  DK_PRODUCT_ROWS,
  DK_PRODUCTS_SQL
} from '../constants/duckdb-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const DUCK = te.encode('DUCK');
const DDB1 = te.encode('DDB1');

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

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function magicEq(bytes: Uint8Array, offset: number, magic: Uint8Array): boolean {
  if (offset < 0 || offset + magic.length > bytes.length) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[offset + i] !== magic[i]) return false;
  return true;
}

function splitCsvish(body: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let quote = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseColumnDef(raw: string, index: number): DkColumn | null {
  const text = raw.trim();
  if (!text || /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)/i.test(text)) return null;
  const m = /^["'`]?([A-Za-z_][\w]*)["'`]?(?:\s+([A-Za-z][\w\s()]*?))?$/i.exec(text.replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const rest = (m[2] || '').trim();
  const typeTok = rest.split(/\s+/)[0] || 'VARCHAR';
  const type = typeTok.replace(/\(.*$/, '').toUpperCase() || 'VARCHAR';
  return {
    id: m[1],
    index,
    name: m[1],
    type,
    nullable: !/\bNOT\s+NULL\b/i.test(text)
  };
}

function parseCreateTable(sql: string, index: number): DkTable | null {
  const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z_][\w]*)["'`]?\s*\(([\s\S]*?)\)\s*;?/i.exec(sql);
  if (!m) return null;
  const name = m[1];
  const columns = splitCsvish(m[2]).map((c, i) => parseColumnDef(c, i)).filter((c): c is DkColumn => !!c);
  if (!columns.length) return null;
  return { id: name, index, name, sql: sql.trim().replace(/\s+/g, ' '), numRows: 0, columns, rows: [] };
}

function parseValueToken(raw: string): string {
  const t = raw.trim();
  if (!t || /^null$/i.test(t)) return '';
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

function applyInserts(tables: DkTable[], sql: string): void {
  const re =
    /INSERT\s+INTO\s+["'`]?([A-Za-z_][\w]*)["'`]?\s*(?:\(([^)]*)\))?\s*VALUES\s*\(([^;]+)\)\s*;?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = tables.find((t) => t.name.toLowerCase() === m![1].toLowerCase());
    if (!table) continue;
    const names = m[2]
      ? m[2].split(',').map((n) => n.trim().replace(/^["'`]|["'`]$/g, ''))
      : table.columns.map((c) => c.name);
    const values = splitCsvish(m[3]).map(parseValueToken);
    const row: Record<string, string> = {};
    names.forEach((n, i) => (row[n] = values[i] ?? ''));
    table.rows.push(row);
    table.numRows = table.rows.length;
  }
}

function scrapeCreateTables(text: string): DkTable[] {
  const tables: DkTable[] = [];
  const re = /CREATE\s+TABLE[\s\S]*?;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const table = parseCreateTable(m[0], tables.length);
    if (table && !tables.some((t) => t.name.toLowerCase() === table.name.toLowerCase())) tables.push(table);
  }
  return tables;
}

function ingestColumn(columns: DkColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'VARCHAR').toUpperCase(),
    nullable: row.nullable !== false
  });
}

function ingestTable(raw: unknown, index: number): DkTable | null {
  const root = rec(raw);
  const name = asString(root.name || root.table || root.id);
  if (!name) return null;
  const columns: DkColumn[] = [];
  const schemaList = Array.isArray(root.columns) ? root.columns : Array.isArray(root.schema) ? root.schema : [];
  schemaList.forEach((item, i) => ingestColumn(columns, rec(item), i));
  const sql = asString(root.sql || root.ddl);
  if (!columns.length && sql) {
    const parsed = parseCreateTable(sql, index);
    if (parsed) columns.push(...parsed.columns);
  }
  const rowList = Array.isArray(root.rows) ? root.rows : Array.isArray(root.data) ? root.data : [];
  const rows: Array<Record<string, string>> = [];
  for (const item of rowList) {
    const row = rec(item);
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestColumn(columns, { name: key, type: 'VARCHAR' }, i));
    const out: Record<string, string> = {};
    for (const c of columns) out[c.name] = cell(row[c.name]);
    rows.push(out);
  }
  if (!columns.length) return null;
  return {
    id: name,
    index,
    name,
    sql: sql || `CREATE TABLE ${name} (${columns.map((c) => `${c.name} ${c.type}`).join(', ')});`,
    numRows: Number(root.numRows || rows.length) || rows.length,
    columns,
    rows
  };
}

function finishDataset(
  name: string,
  sourceKind: DkSourceKind,
  title: string,
  storageVersion: string,
  tables: DkTable[],
  warnings: string[]
): DkDataset {
  if (!tables.length) throw new Error('DuckDB file contains no tables');
  tables.forEach((t, i) => {
    t.index = i;
    t.id = t.name;
    t.numRows = t.numRows || t.rows.length;
  });
  return { name, sourceKind, title: title || name, storageVersion, tables, warnings };
}

export function buildSampleDuckdbBytes(): Uint8Array {
  const meta = te.encode(
    JSON.stringify({
      format: 'duckdb',
      name: 'AnalyticsWh',
      storageVersion: 64,
      tables: [
        {
          name: 'orders',
          sql: DK_ORDERS_SQL,
          columns: [
            { name: 'orderId', type: 'BIGINT', nullable: false },
            { name: 'sku', type: 'VARCHAR', nullable: false },
            { name: 'total', type: 'DOUBLE' },
            { name: 'itemCount', type: 'INTEGER' }
          ],
          rows: DK_ORDER_ROWS
        },
        {
          name: 'products',
          sql: DK_PRODUCTS_SQL,
          columns: [
            { name: 'sku', type: 'VARCHAR', nullable: false },
            { name: 'name', type: 'VARCHAR' },
            { name: 'price', type: 'DOUBLE' }
          ],
          rows: DK_PRODUCT_ROWS
        }
      ]
    })
  );
  const out: number[] = [...DUCK];
  writeU32le(64, out);
  writeU32le(meta.length, out);
  out.push(...meta);
  out.push(...DDB1);
  return Uint8Array.from(out);
}

function parseDuckdbBinary(bytes: Uint8Array, fileName: string): DkDataset {
  if (!magicEq(bytes, 0, DUCK)) throw new Error('Not a DuckDB database (missing DUCK magic)');
  if (bytes.length < 12) throw new Error('DuckDB file is too small');
  const warnings: string[] = [];
  const storageVersion = String(u32le(bytes, 4) || 0);
  let tables: DkTable[] = [];

  if (magicEq(bytes, bytes.length - 4, DDB1)) {
    const jsonLen = u32le(bytes, 8);
    if (jsonLen > 0 && 12 + jsonLen <= bytes.length - 4) {
      try {
        const parsed = JSON.parse(td.decode(bytes.subarray(12, 12 + jsonLen)));
        tables = parseJson(parsed, fileName, 'duckdb').tables;
      } catch {
        warnings.push('DuckDB preview JSON is malformed');
      }
    }
  }

  if (!tables.length) {
    const scrape = td.decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
    tables = scrapeCreateTables(scrape);
    if (!tables.length) {
      const names = [...scrape.matchAll(/[A-Za-z_][A-Za-z0-9_]{1,40}/g)].map((m) => m[0]);
      const skip = new Set(['DUCK', 'DDB', 'schema', 'table', 'varchar', 'bigint', 'integer', 'double', 'null', 'true', 'false']);
      const uniq = [...new Set(names)].filter((n) => !skip.has(n.toUpperCase()) && !skip.has(n.toLowerCase())).slice(0, 8);
      if (uniq.length) {
        tables = [
          {
            id: 'main',
            index: 0,
            name: 'main',
            sql: '',
            numRows: 0,
            columns: uniq.map((name, i) => ({ id: name, index: i, name, type: 'VARCHAR', nullable: true })),
            rows: []
          }
        ];
      }
    }
    warnings.push('DuckDB columnar blocks are not inflated — schema preview only');
  }

  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'DuckDB database';
  return finishDataset(fromFile, 'duckdb', fromFile, storageVersion || '64', tables, warnings);
}

function parseJson(raw: unknown, fileName: string, sourceKind: DkSourceKind = 'json'): DkDataset {
  const root = rec(Array.isArray(raw) ? { tables: raw } : raw);
  const name = asString(root.name || root.title || root.database, fileName.replace(/\.[^.]+$/, '') || 'DuckDB database');
  const tables: DkTable[] = [];
  const list = Array.isArray(root.tables) ? root.tables : Array.isArray(root.relations) ? root.relations : [];
  list.forEach((item, i) => {
    const table = ingestTable(item, i);
    if (table) tables.push(table);
  });
  if (!tables.length && (Array.isArray(root.columns) || Array.isArray(root.rows) || Array.isArray(root.schema))) {
    const table = ingestTable({ name: asString(root.table || root.name, 'orders'), ...root }, 0);
    if (table) tables.push(table);
  }
  if (!tables.length) throw new Error('DuckDB JSON contains no tables');
  return finishDataset(name, sourceKind, asString(root.title || root.name, name), asString(root.storageVersion || root.version, '64'), tables, []);
}

function parseSqlDump(text: string, fileName: string): DkDataset {
  const tables = scrapeCreateTables(text);
  if (!tables.length) throw new Error('SQL dump contains no CREATE TABLE statements');
  applyInserts(tables, text);
  const name = fileName.replace(/\.[^.]+$/, '') || 'DuckDB database';
  return finishDataset(name, 'sql', name, '64', tables, []);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string, fileName: string): DkDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('DuckDB CSV contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('DuckDB CSV contains no schema');
  const columns: DkColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'VARCHAR', nullable: true }));
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] || ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'orders';
  return finishDataset(name, 'csv', name, '64', [{ id: name, index: 0, name, sql: '', numRows: rows.length, columns, rows }], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: DkSourceKind): DkDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'orders').trim();
  const columns: DkColumn[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      columns.push({ id: schema[1], index: columns.length, name: schema[1], type: schema[2].toUpperCase(), nullable: true });
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'VARCHAR', nullable: true }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('DuckDB markdown contains no schema');
  return finishDataset(name, sourceKind, name, '64', [{ id: name, index: 0, name, sql: '', numRows: rows.length, columns, rows }], []);
}

export function parseDuckdbText(text: string, fileName = ''): DkDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('DuckDB file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid DuckDB JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'sql' || /CREATE\s+TABLE/i.test(raw)) return parseSqlDump(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: DkSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not a DuckDB dump');
}

export function parseDuckdbBytes(bytes: Uint8Array, fileName = ''): DkDataset {
  if (!bytes.length) throw new Error('DuckDB file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed DuckDB files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (magicEq(bytes, 0, DUCK) || ext === 'duckdb' || ext === 'ddb') {
    try {
      return parseDuckdbBinary(bytes, fileName);
    } catch (error) {
      if (magicEq(bytes, 0, DUCK) || ext === 'duckdb') throw error;
    }
  }
  return parseDuckdbText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDkTables(tables: DkTable[], query: string): DkTable[] {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tables.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('tbl:') || token.startsWith('table:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('sql:')) return t.sql.toLowerCase().includes(token.slice(4));
      if (token.startsWith('col:') || token.startsWith('type:') || token.startsWith('name:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.sql}`.toLowerCase().includes(token);
    })
  );
}

export function filterDkColumns(columns: DkColumn[], query: string): DkColumn[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  const tokens = q.split(/\s+/).filter(Boolean);
  return columns.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('col:') || token.startsWith('name:')) return c.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('tbl:') || token.startsWith('table:') || token.startsWith('sql:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0 && !token.startsWith('row:')) return true;
      return `${c.name} ${c.type}`.toLowerCase().includes(token);
    })
  );
}

export function filterDkRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:')) return Object.values(row).some((v) => v.toLowerCase().includes(token.slice(4)));
      if (token.startsWith('tbl:') || token.startsWith('table:') || token.startsWith('sql:') || token.startsWith('col:') || token.startsWith('type:') || token.startsWith('name:')) {
        return true;
      }
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
