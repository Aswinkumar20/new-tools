import type { TmColumn, TmDataset, TmKey, TmSourceKind, TmTable } from '../types/toml-viewer.types';
import { TM_TOML_SAMPLE } from '../constants/toml-viewer-sample.data';
import { isGzipMagic, looksLikeMarkdownDump } from './data-file.utils';

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

function looksLikeToml(text: string): boolean {
  const t = text.trim();
  if (!t || looksLikeJson(t)) return false;
  return /^(?:\[[^\]]+\]|[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\s*=)/m.test(t);
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'STRING';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return 'NUMBER';
  if (Array.isArray(value)) return 'ARRAY';
  if (typeof value === 'object') return 'TABLE';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'DATETIME';
  return 'STRING';
}

function previewValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') return `{${Object.keys(value as object).length}}`;
  return String(value).slice(0, 120);
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'STRING';
  if (nonEmpty.every((v) => /^(true|false)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'NUMBER';
  return 'STRING';
}

function stripTomlComment(line: string): string {
  let inS = false;
  let inD = false;
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inD && ch === '\\') {
      esc = true;
      continue;
    }
    if (!inS && ch === '"') {
      inD = !inD;
      continue;
    }
    if (!inD && ch === "'") {
      inS = !inS;
      continue;
    }
    if (!inS && !inD && ch === '#') return line.slice(0, i).trimEnd();
  }
  return line;
}

function unquote(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith('"""') && v.endsWith('"""')) || (v.startsWith("'''") && v.endsWith("'''"))) return v.slice(3, -3);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function splitTopLevel(body: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let inS = false;
  let inD = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inD) {
      cur += ch;
      if (ch === '\\' && body[i + 1]) {
        cur += body[i + 1];
        i += 1;
      } else if (ch === '"') inD = false;
      continue;
    }
    if (inS) {
      cur += ch;
      if (ch === "'") inS = false;
      continue;
    }
    if (ch === '"') {
      inD = true;
      cur += ch;
      continue;
    }
    if (ch === "'") {
      inS = true;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseTomlValue(raw: string): unknown {
  const v = raw.trim();
  if (!v) return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner, ',').map(parseTomlValue);
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim();
    const obj: Record<string, unknown> = {};
    if (!inner) return obj;
    for (const pair of splitTopLevel(inner, ',')) {
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      obj[pair.slice(0, eq).trim()] = parseTomlValue(pair.slice(eq + 1));
    }
    return obj;
  }
  if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(v)) return Number(v.replace(/_/g, ''));
  return unquote(v);
}

function ensureObject(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = target[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) return existing as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  target[key] = next;
  return next;
}

function navigate(root: Record<string, unknown>, parts: string[], asArray: boolean): Record<string, unknown> {
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const last = i === parts.length - 1;
    if (last && asArray) {
      const list = Array.isArray(cur[key]) ? (cur[key] as unknown[]) : [];
      const row: Record<string, unknown> = {};
      list.push(row);
      cur[key] = list;
      return row;
    }
    cur = ensureObject(cur, key);
  }
  return cur;
}

function parseTomlObject(text: string, warnings: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let buf = '';
  let inMulti: '"' | "'" | '' = '';
  for (let i = 0; i < lines.length; i++) {
    const rawLine: string = inMulti ? lines[i] : stripTomlComment(lines[i]);
    if (inMulti) {
      buf += '\n' + lines[i];
      const closer = inMulti === '"' ? '"""' : "'''";
      if (lines[i].includes(closer)) {
        const eq = buf.indexOf('=');
        if (eq >= 0) current[buf.slice(0, eq).trim()] = parseTomlValue(buf.slice(eq + 1).trim());
        buf = '';
        inMulti = '';
      }
      continue;
    }
    const line: string = rawLine.trim();
    if (!line) continue;
    if ((line.includes('"""') && (line.match(/"""/g) || []).length === 1) || (line.includes("'''") && (line.match(/'''/g) || []).length === 1)) {
      inMulti = line.includes('"""') ? '"' : "'";
      buf = line;
      continue;
    }
    if (line.startsWith('[[') && line.endsWith(']]')) {
      const path = line.slice(2, -2).trim().split('.').map((p: string) => p.trim()).filter(Boolean);
      if (!path.length) continue;
      current = navigate(root, path, true);
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      const path = line.slice(1, -1).trim().split('.').map((p: string) => p.trim()).filter(Boolean);
      if (!path.length) {
        current = root;
        continue;
      }
      current = navigate(root, path, false);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) {
      warnings.push(`Ignored TOML line ${i + 1}: expected key = value`);
      continue;
    }
    const keyPath = line.slice(0, eq).trim().split('.').map((p: string) => p.trim()).filter(Boolean);
    const value = parseTomlValue(line.slice(eq + 1));
    if (!keyPath.length) continue;
    if (keyPath.length === 1) current[keyPath[0]] = value;
    else {
      let nest = current;
      for (let k = 0; k < keyPath.length - 1; k++) nest = ensureObject(nest, keyPath[k]);
      nest[keyPath[keyPath.length - 1]] = value;
    }
  }
  if (inMulti) warnings.push('Unclosed multiline TOML string');
  return root;
}

function rowsFromArray(list: unknown[]): { columns: TmColumn[]; rows: Array<Record<string, string>> } {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = rec(item);
    for (const key of Object.keys(row)) {
      if (!seen.has(key) && (typeof row[key] !== 'object' || row[key] === null)) {
        seen.add(key);
        keys.push(key);
      } else if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  const rows: Array<Record<string, string>> = [];
  for (const item of list) {
    const src = rec(item);
    const out: Record<string, string> = {};
    for (const key of keys) out[key] = src[key] == null || typeof src[key] === 'object' ? previewValue(src[key]) : String(src[key]);
    rows.push(out);
  }
  const columns: TmColumn[] = keys.map((name, index) => ({
    id: name,
    index,
    name,
    type: inferColumnType(rows.map((r) => r[name] || ''))
  }));
  return { columns, rows };
}

function collectTables(root: Record<string, unknown>): { tables: TmTable[]; keys: TmKey[]; columns: TmColumn[]; rows: Array<Record<string, string>> } {
  const tables: TmTable[] = [];
  const keys: TmKey[] = [];
  let previewRows: Array<Record<string, string>> = [];
  let previewColumns: TmColumn[] = [];

  const addKeys = (tableName: string, tablePath: string, obj: Record<string, unknown>, into: TmKey[]) => {
    for (const [name, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') continue;
      const path = tablePath ? `${tablePath}.${name}` : name;
      const key: TmKey = {
        id: path,
        index: keys.length,
        name,
        path,
        type: inferType(value),
        value: previewValue(value),
        table: tableName
      };
      keys.push(key);
      into.push(key);
    }
  };

  const rootKeys: TmKey[] = [];
  addKeys('(root)', '', root, rootKeys);
  tables.push({
    id: '(root)',
    index: 0,
    name: '(root)',
    path: '',
    kind: 'root',
    keyCount: rootKeys.length,
    numRows: 0,
    keys: rootKeys,
    rows: []
  });

  for (const [name, value] of Object.entries(root)) {
    if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      const tableKeys: TmKey[] = [];
      const first = rec(value[0]);
      addKeys(name, name, first, tableKeys);
      const extracted = rowsFromArray(value);
      tables.push({
        id: name,
        index: tables.length,
        name,
        path: name,
        kind: 'array-table',
        keyCount: tableKeys.length,
        numRows: value.length,
        keys: tableKeys,
        rows: extracted.rows
      });
      if (!previewRows.length) {
        previewRows = extracted.rows;
        previewColumns = extracted.columns;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const tableKeys: TmKey[] = [];
      addKeys(name, name, rec(value), tableKeys);
      tables.push({
        id: name,
        index: tables.length,
        name,
        path: name,
        kind: 'table',
        keyCount: tableKeys.length,
        numRows: 0,
        keys: tableKeys,
        rows: []
      });
    }
  }

  tables.forEach((t, i) => (t.index = i));
  keys.forEach((k, i) => (k.index = i));
  return { tables, keys, columns: previewColumns, rows: previewRows };
}

function finishDataset(
  name: string,
  sourceKind: TmSourceKind,
  title: string,
  encoding: string,
  root: Record<string, unknown>,
  warnings: string[]
): TmDataset {
  const collected = collectTables(root);
  if (!collected.tables.length) throw new Error('TOML contains no tables');
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    tableCount: collected.tables.length,
    keyCount: collected.keys.length,
    tables: collected.tables,
    keys: collected.keys,
    columns: collected.columns,
    rows: collected.rows,
    warnings
  };
}

function parseTomlDocument(text: string, fileName: string): TmDataset {
  const warnings: string[] = [];
  const root = parseTomlObject(text, warnings);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'TOML document';
  const name = asString(root.name, fromFile);
  return finishDataset(name, 'toml', name, 'UTF-8', root, warnings);
}

function ingestJson(raw: unknown, fileName: string): TmDataset {
  const rootObj = rec(Array.isArray(raw) ? { rows: raw } : raw);
  const name = asString(rootObj.name || rootObj.title, fileName.replace(/\.[^.]+$/, '') || 'TOML document');
  const warnings: string[] = [];
  if (Array.isArray(rootObj.tables) || Array.isArray(rootObj.rows) || Array.isArray(rootObj.keys)) {
    const built: Record<string, unknown> = { name };
    if (rootObj.meta && typeof rootObj.meta === 'object') built.meta = rootObj.meta;
    const tableList = Array.isArray(rootObj.tables) ? rootObj.tables : [];
    for (const item of tableList) {
      const row = rec(item);
      const tableName = asString(row.name || row.table, 'table');
      const keys = rec(row.keys || row.values);
      built[tableName] = Object.keys(keys).length ? keys : rec(row);
    }
    const rowList = Array.isArray(rootObj.rows) ? rootObj.rows : [];
    if (rowList.length) built.orders = rowList;
    return finishDataset(name, 'json', asString(rootObj.title, name), asString(rootObj.encoding, 'UTF-8'), built, warnings);
  }
  return finishDataset(name, 'json', name, 'UTF-8', rootObj, warnings);
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

function parseCsvAsToml(text: string, fileName: string): TmDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('TOML CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('TOML CSV dump contains no schema');
  const orders: Record<string, unknown>[] = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    orders.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'TOML table';
  return finishDataset(name, 'csv', name, 'UTF-8', { name, orders }, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: TmSourceKind): TmDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'TOML table').trim();
  const keys: string[] = [];
  const orders: Record<string, unknown>[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p: string) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!keys.length) {
        parts.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, unknown> = {};
      keys.forEach((k, i) => (row[k] = parts[i] || ''));
      orders.push(row);
    }
  }
  if (!keys.length) throw new Error('TOML markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'UTF-8', { name, orders }, []);
}

export function buildSampleTomlBytes(): Uint8Array {
  return te.encode(TM_TOML_SAMPLE);
}

export function parseTomlText(text: string, fileName = ''): TmDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('TOML file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid TOML JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (looksLikeMarkdownDump(raw, fileName, ['toml'])) {
    return parseMarkdown(raw, fileName, ext === 'md' || ext === 'markdown' ? 'markdown' : 'txt');
  }
  if (ext === 'toml' || looksLikeToml(raw)) return parseTomlDocument(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsToml(raw, fileName);
  throw new Error('Not a TOML dump');
}

export function parseTomlBytes(bytes: Uint8Array, fileName = ''): TmDataset {
  if (!bytes.length) throw new Error('TOML file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed TOML files are not supported — decompress first');
  return parseTomlText(td.decode(bytes), fileName);
}

export function filterTmTables(tables: TmTable[], query: string): TmTable[] {
  const q = query.trim().toLowerCase();
  if (!q) return tables;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tables.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('tbl:') || token.startsWith('table:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:')) return t.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('key:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.kind} ${t.path}`.toLowerCase().includes(token);
    })
  );
}

export function filterTmKeys(keys: TmKey[], query: string): TmKey[] {
  const q = query.trim().toLowerCase();
  if (!q) return keys;
  const tokens = q.split(/\s+/).filter(Boolean);
  return keys.filter((k) =>
    tokens.every((token) => {
      if (token.startsWith('key:') || token.startsWith('name:')) return k.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return k.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('tbl:') || token.startsWith('table:')) return k.table.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('value:')) return k.value.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:') || token.startsWith('kind:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        return k.name.toLowerCase() === key && k.value.toLowerCase().includes(needle);
      }
      return `${k.name} ${k.path} ${k.type} ${k.value} ${k.table}`.toLowerCase().includes(token);
    })
  );
}

export function filterTmRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('value:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('tbl:') || token.startsWith('table:') || token.startsWith('key:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('kind:')) {
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
