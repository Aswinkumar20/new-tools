import type { InColumn, InDataset, InKey, InSection, InSectionKind, InSourceKind } from '../types/ini-viewer.types';
import { IN_INI_SAMPLE } from '../constants/ini-viewer-sample.data';
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
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeIni(text: string): boolean {
  const t = text.trim();
  if (!t || looksLikeJson(t)) return false;
  return /^(?:\s*\[[^\]]+\]\s*$|\s*[A-Za-z0-9_.-]+\s*[=:])/m.test(t);
}

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'STRING';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return 'NUMBER';
  if (Array.isArray(value)) return 'ARRAY';
  if (typeof value === 'object') return 'SECTION';
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
  if (nonEmpty.every((v) => /^(true|false|yes|no|on|off)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'NUMBER';
  return 'STRING';
}

function stripIniComment(line: string): string {
  let inS = false;
  let inD = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inD) {
      if (ch === '\\' && line[i + 1]) {
        i += 1;
        continue;
      }
      if (ch === '"') inD = false;
      continue;
    }
    if (inS) {
      if (ch === "'") inS = false;
      continue;
    }
    if (ch === '"') {
      inD = true;
      continue;
    }
    if (ch === "'") {
      inS = true;
      continue;
    }
    if (ch === ';' || ch === '#') return line.slice(0, i).trimEnd();
  }
  return line;
}

function unquote(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function parseIniScalar(raw: string): unknown {
  const v = unquote(raw.trim());
  if (!v) return '';
  if (/^(true|yes|on)$/i.test(v)) return true;
  if (/^(false|no|off)$/i.test(v)) return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return Number(v);
  return v;
}

function rowsFromObjects(list: unknown[]): { columns: InColumn[]; rows: Array<Record<string, string>> } {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    for (const key of Object.keys(rec(item))) {
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
    for (const key of keys) out[key] = src[key] == null || typeof src[key] === 'object' ? previewValue(src[key]) : String(src[key]);
    rows.push(out);
  }
  const columns: InColumn[] = keys.map((name, index) => ({
    id: name,
    index,
    name,
    type: inferColumnType(rows.map((r) => r[name] || ''))
  }));
  return { columns, rows };
}

function collectSections(root: Record<string, unknown>): {
  sections: InSection[];
  keys: InKey[];
  columns: InColumn[];
  rows: Array<Record<string, string>>;
} {
  const sections: InSection[] = [];
  const keys: InKey[] = [];
  let previewRows: Array<Record<string, string>> = [];
  let previewColumns: InColumn[] = [];

  const addKeys = (sectionName: string, sectionPath: string, obj: Record<string, unknown>, into: InKey[]) => {
    for (const [name, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') continue;
      const path = sectionPath ? `${sectionPath}.${name}` : name;
      const key: InKey = {
        id: path,
        index: keys.length,
        name,
        path,
        type: inferType(value),
        value: previewValue(value),
        section: sectionName
      };
      keys.push(key);
      into.push(key);
    }
  };

  const rootKeys: InKey[] = [];
  const rootScalars: Record<string, unknown> = {};
  const nested: Array<{ name: string; kind: InSectionKind; value: Record<string, unknown> }> = [];
  for (const [name, value] of Object.entries(root)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const dotted = name.includes('.');
      nested.push({ name, kind: dotted ? 'subsection' : 'section', value: rec(value) });
    } else {
      rootScalars[name] = value;
    }
  }
  addKeys('(root)', '', rootScalars, rootKeys);
  sections.push({
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

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const item of nested) {
    const sectionKeys: InKey[] = [];
    addKeys(item.name, item.name, item.value, sectionKeys);
    sections.push({
      id: item.name,
      index: sections.length,
      name: item.name,
      path: item.name,
      kind: item.kind,
      keyCount: sectionKeys.length,
      numRows: 0,
      keys: sectionKeys,
      rows: []
    });
    if (item.kind === 'subsection') {
      const prefix = item.name.split('.')[0] || item.name;
      const list = groups.get(prefix) ?? [];
      list.push({ section: item.name, ...item.value });
      groups.set(prefix, list);
    }
  }

  for (const [prefix, list] of groups) {
    if (list.length < 2) continue;
    const extracted = rowsFromObjects(list);
    const groupKeys: InKey[] = extracted.columns.map((column, index) => ({
      id: `${prefix}.${column.name}`,
      index,
      name: column.name,
      path: `${prefix}.${column.name}`,
      type: column.type,
      value: extracted.rows[0]?.[column.name] || '',
      section: prefix
    }));
    sections.push({
      id: prefix,
      index: sections.length,
      name: prefix,
      path: prefix,
      kind: 'group',
      keyCount: extracted.columns.length,
      numRows: extracted.rows.length,
      keys: groupKeys,
      rows: extracted.rows
    });
    if (!previewRows.length) {
      previewRows = extracted.rows;
      previewColumns = extracted.columns;
    }
  }

  if (!previewRows.length && Array.isArray(root.orders)) {
    const extracted = rowsFromObjects(root.orders as unknown[]);
    previewRows = extracted.rows;
    previewColumns = extracted.columns;
  }

  if (previewRows.length && !sections.some((s) => s.numRows > 0)) {
    const groupKeys: InKey[] = previewColumns.map((column, index) => ({
      id: `orders.${column.name}`,
      index,
      name: column.name,
      path: `orders.${column.name}`,
      type: column.type,
      value: previewRows[0]?.[column.name] || '',
      section: 'orders'
    }));
    sections.push({
      id: 'orders',
      index: sections.length,
      name: 'orders',
      path: 'orders',
      kind: 'group',
      keyCount: previewColumns.length,
      numRows: previewRows.length,
      keys: groupKeys,
      rows: previewRows
    });
  }

  return { sections, keys, columns: previewColumns, rows: previewRows };
}

function finishDataset(
  name: string,
  sourceKind: InSourceKind,
  title: string,
  encoding: string,
  root: Record<string, unknown>,
  warnings: string[]
): InDataset {
  const collected = collectSections(root);
  if (!collected.sections.length && !collected.keys.length) throw new Error('INI contains no values');
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    sectionCount: collected.sections.length,
    keyCount: collected.keys.length,
    sections: collected.sections,
    keys: collected.keys,
    columns: collected.columns,
    rows: collected.rows,
    warnings
  };
}

function parseIniDocument(text: string, fileName: string): InDataset {
  const warnings: string[] = [];
  if (/^\s*\[\[/m.test(text)) warnings.push('[[array-table]] syntax looks like TOML — parsed as INI sections');
  const root: Record<string, unknown> = {};
  let currentName = '';
  let current: Record<string, unknown> = root;
  const seenSections = new Set<string>(['']);
  const seenKeys = new Map<string, Set<string>>();
  seenKeys.set('', new Set());

  for (const [i, rawLine] of text.split(/\r?\n/).entries()) {
    const lineNo = i + 1;
    const line = stripIniComment(rawLine).trim();
    if (!line) continue;
    if (/%\([A-Za-z0-9_.-]+\)[sd]/.test(line)) {
      warnings.push(`Line ${lineNo}: interpolation is not expanded`);
    }
    const sectionMatch = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      if (!name) {
        warnings.push(`Line ${lineNo}: empty section name`);
        continue;
      }
      if (seenSections.has(name)) warnings.push(`Duplicate section [${name}] on line ${lineNo}`);
      seenSections.add(name);
      currentName = name;
      current = rec(root[name]);
      root[name] = current;
      if (!seenKeys.has(name)) seenKeys.set(name, new Set());
      continue;
    }
    const eq = line.indexOf('=');
    const colon = line.indexOf(':');
    const sep = eq >= 0 && (colon < 0 || eq < colon) ? eq : colon;
    if (sep < 0) {
      warnings.push(`Line ${lineNo}: expected key=value`);
      continue;
    }
    const key = unquote(line.slice(0, sep).trim());
    if (!key) {
      warnings.push(`Line ${lineNo}: empty key`);
      continue;
    }
    const bag = seenKeys.get(currentName) ?? new Set<string>();
    if (bag.has(key)) warnings.push(`Duplicate key "${key}" in [${currentName || '(root)'}] on line ${lineNo}`);
    bag.add(key);
    seenKeys.set(currentName, bag);
    current[key] = parseIniScalar(line.slice(sep + 1));
  }

  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'INI document';
  const name = asString(root.name || root.title, fromFile);
  return finishDataset(name, 'ini', asString(root.title || root.name, name), 'UTF-8', root, warnings);
}

function ingestJson(raw: unknown, fileName: string): InDataset {
  const warnings: string[] = [];
  const fromFile = fileName.replace(/\.[^.]+$/, '') || 'INI document';
  if (Array.isArray(raw)) {
    return finishDataset(fromFile, 'json', fromFile, 'UTF-8', { name: fromFile, orders: raw }, warnings);
  }
  const rootObj = rec(raw);
  const name = asString(rootObj.name || rootObj.title, fromFile);
  const built: Record<string, unknown> = {};
  if (rootObj.name != null) built.name = rootObj.name;
  if (rootObj.currency != null) built.currency = rootObj.currency;
  const sectionList = Array.isArray(rootObj.sections) ? rootObj.sections : [];
  for (const item of sectionList) {
    const sec = rec(item);
    const secName = asString(sec.name || sec.section);
    if (!secName) continue;
    built[secName] = rec(sec.keys || sec);
  }
  const rowList = Array.isArray(rootObj.rows) ? rootObj.rows : Array.isArray(rootObj.orders) ? rootObj.orders : [];
  if (rowList.length) built.orders = rowList;
  if (!sectionList.length && !rowList.length) return finishDataset(name, 'json', asString(rootObj.title, name), 'UTF-8', rootObj, warnings);
  return finishDataset(name, 'json', asString(rootObj.title, name), asString(rootObj.encoding, 'UTF-8'), built, warnings);
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

function parseCsvAsIni(text: string, fileName: string): InDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('INI CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('INI CSV dump contains no schema');
  const orders: Record<string, unknown>[] = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    orders.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'INI table';
  return finishDataset(name, 'csv', name, 'UTF-8', { name, orders }, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: InSourceKind): InDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'INI table').trim();
  const keys: string[] = [];
  const orders: Record<string, unknown>[] = [];
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
      const row: Record<string, unknown> = {};
      keys.forEach((k, i) => (row[k] = parts[i] || ''));
      orders.push(row);
    }
  }
  if (!keys.length) throw new Error('INI markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'UTF-8', { name, orders }, []);
}

export function buildSampleIniBytes(): Uint8Array {
  return te.encode(IN_INI_SAMPLE);
}

export function parseIniText(text: string, fileName = ''): InDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('INI file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && ext !== 'ini' && ext !== 'cfg' && ext !== 'conf')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid INI JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (looksLikeMarkdownDump(raw, fileName, ['ini', 'cfg', 'conf'])) {
    return parseMarkdown(raw, fileName, ext === 'md' || ext === 'markdown' ? 'markdown' : 'txt');
  }
  if (ext === 'ini' || ext === 'cfg' || ext === 'conf' || looksLikeIni(raw)) return parseIniDocument(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsIni(raw, fileName);
  throw new Error('Not an INI dump');
}

export function parseIniBytes(bytes: Uint8Array, fileName = ''): InDataset {
  if (!bytes.length) throw new Error('INI file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed INI files are not supported — decompress first');
  return parseIniText(td.decode(bytes), fileName);
}

export function filterInSections(sections: InSection[], query: string): InSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  const tokens = q.split(/\s+/).filter(Boolean);
  return sections.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sec:') || token.startsWith('section:')) return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:')) return s.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('key:') || token.startsWith('name:') || token.startsWith('type:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind} ${s.path}`.toLowerCase().includes(token);
    })
  );
}

export function filterInKeys(keys: InKey[], query: string): InKey[] {
  const q = query.trim().toLowerCase();
  if (!q) return keys;
  const tokens = q.split(/\s+/).filter(Boolean);
  return keys.filter((k) =>
    tokens.every((token) => {
      if (token.startsWith('key:') || token.startsWith('name:')) return k.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return k.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('sec:') || token.startsWith('section:')) return k.section.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('value:')) return k.value.toLowerCase().includes(token.slice(6));
      if (token.startsWith('row:') || token.startsWith('kind:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        return k.name.toLowerCase() === key && k.value.toLowerCase().includes(needle);
      }
      return `${k.name} ${k.path} ${k.type} ${k.value} ${k.section}`.toLowerCase().includes(token);
    })
  );
}

export function filterInRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('value:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (
        token.startsWith('sec:') ||
        token.startsWith('section:') ||
        token.startsWith('key:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('kind:')
      ) {
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
