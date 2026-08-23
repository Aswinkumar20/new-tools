import type {
  JnColumn,
  JnDataset,
  JnNode,
  JnSchemaEntry,
  JnSourceKind,
  JnValueType
} from '../types/json-viewer.types';
import { JN_JSON_SAMPLE } from '../constants/json-viewer-sample.data';
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

function jsonType(value: unknown): JnValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function previewValue(value: unknown, type: JnValueType): string {
  if (type === 'null') return 'null';
  if (type === 'object') return `{${Object.keys(value as object).length}}`;
  if (type === 'array') return `[${(value as unknown[]).length}]`;
  if (type === 'string') return String(value).slice(0, 120);
  return String(value);
}

function collapsePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]');
}

function lastPathName(path: string): string {
  const cleaned = path.replace(/^\$\.?/, '');
  if (!cleaned) return '$';
  const m = /(?:\.|^)([^.\[\]]+)(?:\[\d*\])?$/.exec(path);
  if (m) return m[1];
  const idx = /\[(\d+)\]$/.exec(path);
  if (idx) return `[${idx[1]}]`;
  return cleaned.split('.').pop() || '$';
}

function walkJson(value: unknown, path: string, name: string, depth: number, parentId: string | null, nodes: JnNode[]): void {
  const id = path || '$';
  const type = jsonType(value);
  const childCount =
    type === 'object' ? Object.keys(value as object).length : type === 'array' ? (value as unknown[]).length : 0;
  nodes.push({
    id,
    index: nodes.length,
    name: name || '$',
    path: id,
    type,
    value: previewValue(value, type),
    depth,
    parentId,
    childCount
  });
  if (type === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkJson(child, `${id}.${key}`, key, depth + 1, id, nodes);
    }
  } else if (type === 'array') {
    (value as unknown[]).forEach((child, i) => walkJson(child, `${id}[${i}]`, `[${i}]`, depth + 1, id, nodes));
  }
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'STRING';
  if (nonEmpty.every((v) => /^(true|false)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+$/.test(v))) return 'NUMBER';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'NUMBER';
  if (nonEmpty.every((v) => v === 'null')) return 'NULL';
  return 'STRING';
}

function buildSchema(nodes: JnNode[]): JnSchemaEntry[] {
  const map = new Map<string, JnSchemaEntry>();
  for (const node of nodes) {
    const path = collapsePath(node.path);
    const existing = map.get(path);
    if (!existing) {
      map.set(path, {
        id: path,
        index: map.size,
        path,
        name: lastPathName(path),
        type: node.type.toUpperCase(),
        nullable: node.type === 'null',
        childCount: node.childCount,
        sample: node.value
      });
      continue;
    }
    if (node.type === 'null') existing.nullable = true;
    else if (existing.type === 'NULL') existing.type = node.type.toUpperCase();
    else if (existing.type !== node.type.toUpperCase()) existing.type = 'STRING';
    existing.childCount = Math.max(existing.childCount, node.childCount);
    if (!existing.sample || existing.sample === 'null') existing.sample = node.value;
  }
  return [...map.values()].map((e, i) => ({ ...e, index: i }));
}

function rowsFromArray(list: unknown[]): { columns: JnColumn[]; rows: Array<Record<string, string>> } {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = rec(item);
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  const rows: Array<Record<string, string>> = [];
  for (const item of list) {
    const src = rec(item);
    const out: Record<string, string> = {};
    for (const key of keys) out[key] = src[key] == null ? '' : String(src[key]);
    rows.push(out);
  }
  const columns: JnColumn[] = keys.map((name, index) => ({
    id: name,
    index,
    name,
    type: inferColumnType(rows.map((r) => r[name] || ''))
  }));
  return { columns, rows };
}

function extractTable(value: unknown): { columns: JnColumn[]; rows: Array<Record<string, string>> } {
  if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
    return rowsFromArray(value);
  }
  const root = rec(value);
  for (const key of ['orders', 'rows', 'data', 'items', 'records', 'results']) {
    const list = root[key];
    if (Array.isArray(list) && list.length && list.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return rowsFromArray(list);
    }
  }
  return { columns: [], rows: [] };
}

function finishDataset(
  name: string,
  sourceKind: JnSourceKind,
  title: string,
  encoding: string,
  value: unknown,
  warnings: string[]
): JnDataset {
  const nodes: JnNode[] = [];
  walkJson(value, '$', '$', 0, null, nodes);
  if (!nodes.length) throw new Error('JSON contains no values');
  const schema = buildSchema(nodes);
  const table = extractTable(value);
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    rootType: jsonType(value),
    nodeCount: nodes.length,
    maxDepth,
    nodes,
    schema,
    columns: table.columns,
    rows: table.rows,
    warnings
  };
}

function parseJsonValue(value: unknown, fileName: string, sourceKind: JnSourceKind, warnings: string[] = []): JnDataset {
  const fromFile =
    fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'JSON document';
  let name = fromFile;
  let title = fromFile;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const root = rec(value);
    name = asString(root.name || root.title, fromFile);
    title = asString(root.title || root.name, name);
  }
  return finishDataset(name, sourceKind, title, 'UTF-8', value, warnings);
}

function looksLikeJsonl(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) return false;
  return lines.every((line) => line.startsWith('{') || line.startsWith('['));
}

function parseJsonl(text: string, fileName: string): JnDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const rows: unknown[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      rows.push(JSON.parse(lines[i]));
    } catch {
      warnings.push(`JSONL line ${i + 1} is not valid JSON`);
    }
  }
  if (!rows.length) throw new Error('JSONL contains no records');
  const name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'JSONL records';
  return finishDataset(name, 'jsonl', name, 'UTF-8', rows, warnings);
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

function parseCsvAsJson(text: string, fileName: string): JnDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('JSON CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('JSON CSV dump contains no schema');
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'JSON table';
  return finishDataset(name, 'csv', name, 'UTF-8', rows, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: JnSourceKind): JnDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'JSON table').trim();
  const keys: string[] = [];
  const rows: Record<string, string>[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!keys.length) {
        parts.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = parts[i] || ''));
      rows.push(row);
    }
  }
  if (!keys.length) throw new Error('JSON markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'UTF-8', rows, []);
}

export function buildSampleJsonBytes(): Uint8Array {
  return te.encode(JN_JSON_SAMPLE);
}

export function parseJsonText(text: string, fileName = ''): JnDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('JSON file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    try {
      return parseJsonValue(JSON.parse(raw), fileName, 'json');
    } catch (error) {
      if (ext === 'json' || !looksLikeJsonl(raw)) {
        throw error instanceof Error && /JSON/.test(error.message) ? new Error('Invalid JSON') : new Error('Invalid JSON');
      }
    }
  }
  if (ext === 'jsonl' || ext === 'ndjson' || looksLikeJsonl(raw)) return parseJsonl(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsJson(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a JSON dump');
}

export function parseJsonBytes(bytes: Uint8Array, fileName = ''): JnDataset {
  if (!bytes.length) throw new Error('JSON file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed JSON files are not supported — decompress first');
  return parseJsonText(td.decode(bytes), fileName);
}

export function filterJnNodes(nodes: JnNode[], query: string): JnNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('path:')) return n.path.toLowerCase().includes(token.slice(5));
      if (token.startsWith('name:') || token.startsWith('key:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return n.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('value:')) return n.value.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        return n.name.toLowerCase() === key && n.value.toLowerCase().includes(needle);
      }
      return `${n.name} ${n.path} ${n.type} ${n.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterJnSchema(schema: JnSchemaEntry[], query: string): JnSchemaEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return schema;
  const tokens = q.split(/\s+/).filter(Boolean);
  return schema.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('path:')) return s.path.toLowerCase().includes(token.slice(5));
      if (token.startsWith('name:') || token.startsWith('key:')) return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return s.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('value:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.path} ${s.type} ${s.sample}`.toLowerCase().includes(token);
    })
  );
}

export function filterJnRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('value:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('path:') || token.startsWith('name:') || token.startsWith('key:') || token.startsWith('type:')) return true;
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
