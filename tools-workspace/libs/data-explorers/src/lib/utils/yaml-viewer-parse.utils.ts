import type {
  YlColumn,
  YlDataset,
  YlIssue,
  YlNode,
  YlSchemaEntry,
  YlSourceKind,
  YlValueType
} from '../types/yaml-viewer.types';
import { YL_YAML_SAMPLE } from '../constants/yaml-viewer-sample.data';
import { isGzipMagic, looksLikeMarkdownDump } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

interface YamlLine {
  indent: number;
  text: string;
  line: number;
}

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

function looksLikeYaml(text: string): boolean {
  const t = text.trim();
  if (!t || looksLikeJson(t)) return false;
  if (/^---\s*$/m.test(t) || /^%YAML/m.test(t)) return true;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return false;
  return lines.some((l) => /^[\w."'-]+\s*:/.test(l) || l.startsWith('- '));
}

function yamlType(value: unknown): YlValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function previewValue(value: unknown, type: YlValueType): string {
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
  const m = /(?:\.|^)([^.\[\]]+)(?:\[\d*\])?$/.exec(path);
  if (m) return m[1];
  const idx = /\[(\d+)\]$/.exec(path);
  if (idx) return `[${idx[1]}]`;
  return path.replace(/^\$\.?/, '') || '$';
}

function walkYaml(value: unknown, path: string, name: string, depth: number, parentId: string | null, nodes: YlNode[]): void {
  const id = path || '$';
  const type = yamlType(value);
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
      walkYaml(child, `${id}.${key}`, key, depth + 1, id, nodes);
    }
  } else if (type === 'array') {
    (value as unknown[]).forEach((child, i) => walkYaml(child, `${id}[${i}]`, `[${i}]`, depth + 1, id, nodes));
  }
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'STRING';
  if (nonEmpty.every((v) => /^(true|false)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'NUMBER';
  if (nonEmpty.every((v) => v === 'null')) return 'NULL';
  return 'STRING';
}

function buildSchema(nodes: YlNode[]): YlSchemaEntry[] {
  const map = new Map<string, YlSchemaEntry>();
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

function rowsFromArray(list: unknown[]): { columns: YlColumn[]; rows: Array<Record<string, string>> } {
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
  const columns: YlColumn[] = keys.map((name, index) => ({
    id: name,
    index,
    name,
    type: inferColumnType(rows.map((r) => r[name] || ''))
  }));
  return { columns, rows };
}

function extractTable(value: unknown): { columns: YlColumn[]; rows: Array<Record<string, string>> } {
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

function parseScalar(raw: string): unknown {
  const v = raw.trim();
  if (!v || v === '~' || /^null$/i.test(v)) return null;
  if (/^(true|yes|on)$/i.test(v)) return true;
  if (/^(false|no|off)$/i.test(v)) return false;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) {
    try {
      return JSON.parse(v.replace(/'/g, '"'));
    } catch {
      return v;
    }
  }
  return v.replace(/\s+#.*$/, '').trim();
}

function unquoteKey(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function toYamlLines(text: string, issues: YlIssue[]): YamlLine[] {
  const out: YamlLine[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    if (/\t/.test(raw)) {
      issues.push({
        id: `tabs-${lineNo}`,
        index: issues.length,
        severity: 'warning',
        code: 'tabs',
        message: `Line ${lineNo} uses tabs for indentation`,
        line: lineNo,
        path: ''
      });
    }
    const expanded = raw.replace(/\t/g, '  ');
    const trimmed = expanded.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const indent = expanded.length - expanded.trimStart().length;
    if (indent % 2 !== 0) {
      issues.push({
        id: `indent-${lineNo}`,
        index: issues.length,
        severity: 'warning',
        code: 'indent',
        message: `Line ${lineNo} indent is not a multiple of 2`,
        line: lineNo,
        path: ''
      });
    }
    out.push({ indent, text: trimmed.replace(/\s+#.*$/, '').trim(), line: lineNo });
  });
  return out;
}

function parseYamlMap(lines: YamlLine[], start: number, indent: number, issues: YlIssue[]): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      issues.push({
        id: `orphan-${line.line}`,
        index: issues.length,
        severity: 'warning',
        code: 'indent',
        message: `Line ${line.line} is unexpectedly nested`,
        line: line.line,
        path: ''
      });
      i += 1;
      continue;
    }
    if (line.text.startsWith('- ')) break;
    const colon = line.text.indexOf(':');
    if (colon < 0) {
      issues.push({
        id: `syntax-${line.line}`,
        index: issues.length,
        severity: 'error',
        code: 'syntax',
        message: `Line ${line.line} expected a key: value pair`,
        line: line.line,
        path: ''
      });
      i += 1;
      continue;
    }
    const key = unquoteKey(line.text.slice(0, colon));
    const rest = line.text.slice(colon + 1).trim();
    if (key in obj) {
      issues.push({
        id: `dup-${line.line}-${key}`,
        index: issues.length,
        severity: 'warning',
        code: 'duplicate-key',
        message: `Duplicate key "${key}" on line ${line.line}`,
        line: line.line,
        path: key
      });
    }
    if (rest && rest !== '|' && rest !== '>') {
      if ((rest.startsWith('"') && !rest.endsWith('"')) || (rest.startsWith("'") && !rest.endsWith("'"))) {
        issues.push({
          id: `quote-${line.line}`,
          index: issues.length,
          severity: 'error',
          code: 'unclosed-quote',
          message: `Unclosed quote on line ${line.line}`,
          line: line.line,
          path: key
        });
      }
      obj[key] = parseScalar(rest);
      i += 1;
    } else {
      const nested = parseYamlLines(lines, i + 1, indent + 1, issues);
      obj[key] = nested.value;
      i = nested.next;
    }
  }
  return { value: obj, next: i };
}

function parseYamlSeq(lines: YamlLine[], start: number, indent: number, issues: YlIssue[]): { value: unknown[]; next: number } {
  const arr: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent !== indent || !line.text.startsWith('- ')) break;
    const rest = line.text.slice(2).trim();
    if (!rest) {
      const nested = parseYamlLines(lines, i + 1, indent + 1, issues);
      arr.push(nested.value);
      i = nested.next;
      continue;
    }
    if (rest.includes(':') && !/^['"]/.test(rest) && !rest.startsWith('{') && !rest.startsWith('[')) {
      const colon = rest.indexOf(':');
      const key = unquoteKey(rest.slice(0, colon));
      const val = rest.slice(colon + 1).trim();
      const item: Record<string, unknown> = {};
      if (val && val !== '|' && val !== '>') {
        item[key] = parseScalar(val);
        i += 1;
      } else {
        const nested = parseYamlLines(lines, i + 1, indent + 1, issues);
        item[key] = nested.value;
        i = nested.next;
      }
      while (i < lines.length && lines[i].indent > indent && !lines[i].text.startsWith('- ')) {
        const more = parseYamlMap(lines, i, lines[i].indent, issues);
        Object.assign(item, more.value);
        i = more.next;
      }
      arr.push(item);
    } else {
      arr.push(parseScalar(rest));
      i += 1;
    }
  }
  return { value: arr, next: i };
}

function parseYamlLines(lines: YamlLine[], start: number, minIndent: number, issues: YlIssue[]): { value: unknown; next: number } {
  if (start >= lines.length || lines[start].indent < minIndent) return { value: {}, next: start };
  if (lines[start].text.startsWith('- ')) return parseYamlSeq(lines, start, lines[start].indent, issues);
  return parseYamlMap(lines, start, lines[start].indent, issues);
}

function finishDataset(
  name: string,
  sourceKind: YlSourceKind,
  title: string,
  encoding: string,
  value: unknown,
  issues: YlIssue[],
  warnings: string[]
): YlDataset {
  const nodes: YlNode[] = [];
  walkYaml(value, '$', '$', 0, null, nodes);
  if (!nodes.length) throw new Error('YAML contains no values');
  const schema = buildSchema(nodes);
  const table = extractTable(value);
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  const valid = !issues.some((i) => i.severity === 'error');
  issues.forEach((issue, i) => (issue.index = i));
  if (!valid) warnings.push(`${issues.filter((i) => i.severity === 'error').length} validation error(s)`);
  else if (issues.length) warnings.push(`${issues.length} validation warning(s)`);
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    rootType: yamlType(value),
    nodeCount: nodes.length,
    maxDepth,
    valid,
    nodes,
    issues,
    schema,
    columns: table.columns,
    rows: table.rows,
    warnings
  };
}

function parseYamlDocument(text: string, fileName: string): YlDataset {
  const issues: YlIssue[] = [];
  const warnings: string[] = [];
  const docs = text
    .split(/^\s*---\s*$/m)
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('%YAML') && !d.startsWith('%TAG'));
  if (docs.length > 1) {
    warnings.push(`${docs.length} YAML documents found — using the first`);
    issues.push({
      id: 'multidoc',
      index: 0,
      severity: 'warning',
      code: 'multidoc',
      message: 'Multiple YAML documents; only the first is shown',
      line: 1,
      path: ''
    });
  }
  const source = docs[0] || text;
  const lines = toYamlLines(source, issues);
  if (!lines.length) throw new Error('YAML contains no values');
  const value = parseYamlLines(lines, 0, 0, issues).value;
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'YAML document';
  const root = rec(value);
  const name = asString(root.name || root.title, fromFile);
  return finishDataset(name, 'yaml', asString(root.title || root.name, name), 'UTF-8', value, issues, warnings);
}

function parseJsonAsYaml(raw: unknown, fileName: string): YlDataset {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'YAML document';
  let name = fromFile;
  let title = fromFile;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const root = rec(raw);
    name = asString(root.name || root.title, fromFile);
    title = asString(root.title || root.name, name);
  }
  return finishDataset(name, 'json', title, 'UTF-8', raw, [], []);
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

function parseCsvAsYaml(text: string, fileName: string): YlDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('YAML CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('YAML CSV dump contains no schema');
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    rows.push(row);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'YAML table';
  return finishDataset(name, 'csv', name, 'UTF-8', rows, [], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: YlSourceKind): YlDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'YAML table').trim();
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
  if (!keys.length) throw new Error('YAML markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'UTF-8', rows, [], []);
}

export function buildSampleYamlBytes(): Uint8Array {
  return te.encode(YL_YAML_SAMPLE);
}

export function parseYamlText(text: string, fileName = ''): YlDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('YAML file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid YAML JSON');
    }
    return parseJsonAsYaml(parsed, fileName);
  }
  if (looksLikeMarkdownDump(raw, fileName, ['yaml', 'yml'])) {
    return parseMarkdown(raw, fileName, ext === 'md' || ext === 'markdown' ? 'markdown' : 'txt');
  }
  if (ext === 'yaml' || ext === 'yml' || looksLikeYaml(raw)) return parseYamlDocument(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsYaml(raw, fileName);
  throw new Error('Not a YAML dump');
}

export function parseYamlBytes(bytes: Uint8Array, fileName = ''): YlDataset {
  if (!bytes.length) throw new Error('YAML file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed YAML files are not supported — decompress first');
  return parseYamlText(td.decode(bytes), fileName);
}

export function filterYlNodes(nodes: YlNode[], query: string): YlNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('path:')) return n.path.toLowerCase().includes(token.slice(5));
      if (token.startsWith('name:') || token.startsWith('key:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:')) return n.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('value:')) return n.value.toLowerCase().includes(token.slice(6));
      if (token.startsWith('issue:') || token.startsWith('row:')) return true;
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

export function filterYlIssues(issues: YlIssue[], query: string): YlIssue[] {
  const q = query.trim().toLowerCase();
  if (!q) return issues;
  const tokens = q.split(/\s+/).filter(Boolean);
  return issues.filter((issue) =>
    tokens.every((token) => {
      if (token.startsWith('issue:') || token.startsWith('code:')) return issue.code.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('sev:')) return issue.severity.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('path:') || token.startsWith('name:') || token.startsWith('key:') || token.startsWith('value:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${issue.code} ${issue.severity} ${issue.message} ${issue.path}`.toLowerCase().includes(token);
    })
  );
}

export function filterYlRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('value:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('path:') || token.startsWith('name:') || token.startsWith('key:') || token.startsWith('type:') || token.startsWith('issue:')) {
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
