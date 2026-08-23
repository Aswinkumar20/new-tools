import type { SqColumn, SqDataset, SqSourceKind, SqTable } from '../types/sqlite-viewer.types';
import {
  SQ_ORDER_ROWS,
  SQ_ORDERS_SQL,
  SQ_PRODUCT_ROWS,
  SQ_PRODUCTS_SQL
} from '../constants/sqlite-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const SQLITE_MAGIC = te.encode('SQLite format 3\0');
const SQL1 = te.encode('SQL1');

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

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU16be(value: number, out: Uint8Array, offset: number): void {
  out[offset] = (value >> 8) & 0xff;
  out[offset + 1] = value & 0xff;
}

function writeU32be(value: number, out: Uint8Array, offset: number): void {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
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

function parseColumnDef(raw: string, index: number): SqColumn | null {
  const text = raw.trim();
  if (!text || /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)/i.test(text)) return null;
  const m = /^["'`]?([A-Za-z_][\w]*)["'`]?(?:\s+([A-Za-z][\w\s()]*?))?$/i.exec(text.replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const rest = (m[2] || '').trim();
  const typeTok = rest.split(/\s+/)[0] || 'BLOB';
  const type = typeTok.replace(/\(.*$/, '').toUpperCase() || 'BLOB';
  return {
    id: m[1],
    index,
    name: m[1],
    type,
    nullable: !/\bNOT\s+NULL\b/i.test(text),
    pk: /\bPRIMARY\s+KEY\b/i.test(text)
  };
}

function parseCreateTable(sql: string, index: number): SqTable | null {
  const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z_][\w]*)["'`]?\s*\(([\s\S]*?)\)\s*;?/i.exec(sql);
  if (!m) return null;
  const name = m[1];
  if (/^sqlite_/i.test(name)) return null;
  const columns = splitCsvish(m[2]).map((c, i) => parseColumnDef(c, i)).filter((c): c is SqColumn => !!c);
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

function applyInserts(tables: SqTable[], sql: string): void {
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

function scrapeCreateTables(text: string): SqTable[] {
  const tables: SqTable[] = [];
  const re = /CREATE\s+TABLE[\s\S]*?;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const table = parseCreateTable(m[0], tables.length);
    if (table && !tables.some((t) => t.name.toLowerCase() === table.name.toLowerCase())) tables.push(table);
  }
  return tables;
}

function ingestColumn(columns: SqColumn[], row: Record<string, unknown>, index: number): void {
  const name = asString(row.name || row.column || row.field || row.id);
  if (!name) return;
  columns.push({
    id: name,
    index,
    name,
    type: asString(row.type || row.dataType, 'TEXT').toUpperCase(),
    nullable: row.nullable !== false,
    pk: row.pk === true || /\bpk\b/i.test(asString(row.key))
  });
}

function ingestTable(raw: unknown, index: number): SqTable | null {
  const root = rec(raw);
  const name = asString(root.name || root.table || root.id);
  if (!name) return null;
  const columns: SqColumn[] = [];
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
    if (!columns.length) Object.keys(row).forEach((key, i) => ingestColumn(columns, { name: key, type: 'TEXT' }, i));
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
  sourceKind: SqSourceKind,
  title: string,
  pageSize: number,
  encoding: string,
  pageCount: number,
  tables: SqTable[],
  warnings: string[]
): SqDataset {
  if (!tables.length) throw new Error('SQLite file contains no tables');
  tables.forEach((t, i) => {
    t.index = i;
    t.id = t.name;
    t.numRows = t.numRows || t.rows.length;
  });
  return { name, sourceKind, title: title || name, pageSize, encoding, pageCount, tables, warnings };
}

function encodingName(code: number): string {
  if (code === 2) return 'UTF-16le';
  if (code === 3) return 'UTF-16be';
  return 'UTF-8';
}

export function buildSampleSqliteBytes(): Uint8Array {
  const pageSize = 1024;
  const page = new Uint8Array(pageSize);
  page.set(SQLITE_MAGIC, 0);
  writeU16be(pageSize, page, 16);
  page[18] = 1;
  page[19] = 1;
  page[21] = 64;
  page[22] = 32;
  page[23] = 32;
  writeU32be(1, page, 28);
  writeU32be(4, page, 44);
  writeU32be(1, page, 56);
  writeU32be(3037000, page, 96);
  const ddl = te.encode(`${SQ_ORDERS_SQL}\n${SQ_PRODUCTS_SQL}\n`);
  page.set(ddl, 100);

  const meta = te.encode(
    JSON.stringify({
      format: 'sqlite',
      name: 'LibraryDb',
      tables: [
        {
          name: 'orders',
          sql: SQ_ORDERS_SQL,
          columns: [
            { name: 'orderId', type: 'INTEGER', pk: true, nullable: false },
            { name: 'sku', type: 'TEXT', nullable: false },
            { name: 'total', type: 'REAL' },
            { name: 'itemCount', type: 'INTEGER' }
          ],
          rows: SQ_ORDER_ROWS
        },
        {
          name: 'products',
          sql: SQ_PRODUCTS_SQL,
          columns: [
            { name: 'sku', type: 'TEXT', pk: true, nullable: false },
            { name: 'name', type: 'TEXT' },
            { name: 'price', type: 'REAL' }
          ],
          rows: SQ_PRODUCT_ROWS
        }
      ]
    })
  );
  const out: number[] = [...page, ...meta];
  writeU32le(meta.length, out);
  out.push(...SQL1);
  return Uint8Array.from(out);
}

function parseSqliteHeader(bytes: Uint8Array): { pageSize: number; pageCount: number; encoding: string } {
  let pageSize = u16be(bytes, 16);
  if (pageSize === 1) pageSize = 65536;
  if (pageSize < 512 || (pageSize & (pageSize - 1)) !== 0) pageSize = 1024;
  const pageCount = u32be(bytes, 28) || Math.max(1, Math.floor(bytes.length / pageSize));
  return { pageSize, pageCount, encoding: encodingName(u32be(bytes, 56)) };
}

function parseSqliteBinary(bytes: Uint8Array, fileName: string): SqDataset {
  if (!magicEq(bytes, 0, SQLITE_MAGIC)) throw new Error('Not a SQLite database (missing header magic)');
  if (bytes.length < 100) throw new Error('SQLite file is too small');
  const header = parseSqliteHeader(bytes);
  const warnings: string[] = [];
  let tables: SqTable[] = [];

  if (magicEq(bytes, bytes.length - 4, SQL1)) {
    const metaLen = u32le(bytes, bytes.length - 8);
    if (metaLen > 0 && metaLen < bytes.length - 8) {
      const metaStart = bytes.length - 8 - metaLen;
      try {
        const parsed = JSON.parse(td.decode(bytes.subarray(metaStart, metaStart + metaLen)));
        const ds = parseJson(parsed, fileName, 'sqlite');
        tables = ds.tables;
      } catch {
        warnings.push('SQLite preview footer JSON is malformed');
      }
    }
  }

  if (!tables.length) {
    const scrapeLen = Math.min(bytes.length, Math.max(header.pageSize * 2, 16 * 1024));
    tables = scrapeCreateTables(td.decode(bytes.subarray(0, scrapeLen)));
    if (!tables.length) warnings.push('Could not extract sqlite_master CREATE TABLE statements');
    else warnings.push('B-tree row pages are not inflated — schema SQL only');
  }

  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'SQLite database';
  return finishDataset(fromFile, 'sqlite', fromFile, header.pageSize, header.encoding, header.pageCount, tables, warnings);
}

function parseJson(raw: unknown, fileName: string, sourceKind: SqSourceKind = 'json'): SqDataset {
  const root = rec(Array.isArray(raw) ? { tables: raw } : raw);
  const name = asString(root.name || root.title || root.database, fileName.replace(/\.[^.]+$/, '') || 'SQLite database');
  const tables: SqTable[] = [];
  const list = Array.isArray(root.tables) ? root.tables : Array.isArray(root.relations) ? root.relations : [];
  list.forEach((item, i) => {
    const table = ingestTable(item, i);
    if (table) tables.push(table);
  });
  if (!tables.length && (Array.isArray(root.columns) || Array.isArray(root.rows) || Array.isArray(root.schema))) {
    const table = ingestTable({ name: asString(root.table || root.name, 'orders'), ...root }, 0);
    if (table) tables.push(table);
  }
  if (!tables.length) throw new Error('SQLite JSON contains no tables');
  return finishDataset(
    name,
    sourceKind,
    asString(root.title || root.name, name),
    Number(root.pageSize || 0) || 0,
    asString(root.encoding, 'UTF-8'),
    Number(root.pageCount || 0) || 0,
    tables,
    []
  );
}

function parseSqlDump(text: string, fileName: string): SqDataset {
  const tables = scrapeCreateTables(text);
  if (!tables.length) throw new Error('SQL dump contains no CREATE TABLE statements');
  applyInserts(tables, text);
  const name = fileName.replace(/\.[^.]+$/, '') || 'SQLite database';
  return finishDataset(name, 'sql', name, 0, 'UTF-8', 0, tables, []);
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

function parseCsv(text: string, fileName: string): SqDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('SQLite CSV contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('SQLite CSV contains no schema');
  const columns: SqColumn[] = header.map((name, i) => ({ id: name, index: i, name, type: 'TEXT', nullable: true, pk: false }));
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] || ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'orders';
  return finishDataset(name, 'csv', name, 0, 'UTF-8', 0, [{ id: name, index: 0, name, sql: '', numRows: rows.length, columns, rows }], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: SqSourceKind): SqDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'orders').trim();
  const columns: SqColumn[] = [];
  const rows: Array<Record<string, string>> = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      columns.push({ id: schema[1], index: columns.length, name: schema[1], type: schema[2].toUpperCase(), nullable: true, pk: false });
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!columns.length) {
        parts.forEach((p, i) => columns.push({ id: p, index: i, name: p, type: 'TEXT', nullable: true, pk: false }));
        continue;
      }
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.name] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!columns.length) throw new Error('SQLite markdown contains no schema');
  return finishDataset(name, sourceKind, name, 0, 'UTF-8', 0, [{ id: name, index: 0, name, sql: '', numRows: rows.length, columns, rows }], []);
}

export function parseSqliteText(text: string, fileName = ''): SqDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('SQLite file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid SQLite JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (ext === 'sql' || /CREATE\s+TABLE/i.test(raw)) return parseSqlDump(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsv(raw, fileName);
  const sourceKind: SqSourceKind = ext === 'md' ? 'markdown' : 'txt';
  if (/^#\s+/m.test(raw) || /:\s+[A-Za-z]/.test(raw) || raw.includes('|')) return parseMarkdown(raw, fileName, sourceKind);
  throw new Error('Not a SQLite dump');
}

export function parseSqliteBytes(bytes: Uint8Array, fileName = ''): SqDataset {
  if (!bytes.length) throw new Error('SQLite file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed SQLite files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (magicEq(bytes, 0, SQLITE_MAGIC) || ext === 'sqlite' || ext === 'sqlite3' || ext === 'db' || ext === 'db3') {
    try {
      return parseSqliteBinary(bytes, fileName);
    } catch (error) {
      if (magicEq(bytes, 0, SQLITE_MAGIC) || ext === 'sqlite' || ext === 'sqlite3') throw error;
    }
  }
  return parseSqliteText(td.decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSqTables(tables: SqTable[], query: string): SqTable[] {
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

export function filterSqColumns(columns: SqColumn[], query: string): SqColumn[] {
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

export function filterSqRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
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
