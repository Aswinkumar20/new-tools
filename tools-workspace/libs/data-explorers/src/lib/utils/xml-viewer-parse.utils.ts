import type {
  XmAttribute,
  XmColumn,
  XmDataset,
  XmNode,
  XmSchemaEntry,
  XmSourceKind
} from '../types/xml-viewer.types';
import { XM_XML_SAMPLE } from '../constants/xml-viewer-sample.data';
import { isGzipMagic } from './data-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');

interface XmlElem {
  name: string;
  attrs: Record<string, string>;
  text: string;
  children: XmlElem[];
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

function looksLikeXml(text: string): boolean {
  return /<\?xml\b|<([:\w.-]+)[\s>/]/i.test(text.trim());
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = decodeEntities(m[2] ?? m[3] ?? '');
  return out;
}

function findTagEnd(s: string, start: number): number {
  let i = start + 1;
  let quote = '';
  while (i < s.length) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
    i += 1;
  }
  return -1;
}

function parseXmlTree(xml: string, warnings: string[]): XmlElem {
  let source = xml.replace(/^\uFEFF/, '');
  if (/<!--/.test(source)) warnings.push('XML comments were stripped');
  if (/<!\[CDATA\[/.test(source)) warnings.push('CDATA sections were inlined as text');
  source = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t) =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    )
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  const stack: XmlElem[] = [{ name: '#root', attrs: {}, text: '', children: [] }];
  let i = 0;
  while (i < source.length) {
    if (source[i] !== '<') {
      const next = source.indexOf('<', i);
      const chunk = source.slice(i, next < 0 ? source.length : next);
      stack[stack.length - 1].text += decodeEntities(chunk);
      if (next < 0) break;
      i = next;
      continue;
    }
    if (source.startsWith('<?', i)) {
      const end = source.indexOf('?>', i);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (source.startsWith('</', i)) {
      const end = findTagEnd(source, i);
      if (end < 0) break;
      const name = source.slice(i + 2, end).trim().split(/\s+/)[0];
      if (stack.length > 1) {
        if (stack[stack.length - 1].name !== name) {
          warnings.push(`Closing tag </${name}> did not match <${stack[stack.length - 1].name}>`);
        }
        const el = stack.pop() as XmlElem;
        el.text = el.text.replace(/\s+/g, ' ').trim();
      }
      i = end + 1;
      continue;
    }
    const end = findTagEnd(source, i);
    if (end < 0) {
      warnings.push('Unterminated XML tag');
      break;
    }
    const raw = source.slice(i + 1, end).trim();
    const selfClosing = raw.endsWith('/');
    const body = (selfClosing ? raw.slice(0, -1) : raw).trim();
    const nameMatch = /^([:\w.-]+)/.exec(body);
    if (!nameMatch) {
      i = end + 1;
      continue;
    }
    const el: XmlElem = { name: nameMatch[1], attrs: parseAttrs(body.slice(nameMatch[0].length)), text: '', children: [] };
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
    i = end + 1;
  }
  while (stack.length > 1) {
    warnings.push(`Unclosed <${stack[stack.length - 1].name}> tag`);
    const el = stack.pop() as XmlElem;
    el.text = el.text.replace(/\s+/g, ' ').trim();
  }
  const roots = stack[0].children;
  if (!roots.length) throw new Error('XML contains no elements');
  if (roots.length > 1) warnings.push('Multiple root elements — using the first');
  return roots[0];
}

function flattenXml(
  el: XmlElem,
  path: string,
  depth: number,
  nodes: XmNode[],
  attributes: XmAttribute[],
  counters: Map<string, number>
): void {
  const siblingKey = `${path}/${el.name}`;
  const n = (counters.get(siblingKey) || 0) + 1;
  counters.set(siblingKey, n);
  const id = `${path}/${el.name}[${n}]`;
  const attrEntries = Object.entries(el.attrs);
  nodes.push({
    id,
    index: nodes.length,
    name: el.name,
    path: id,
    text: el.text,
    depth,
    childCount: el.children.length,
    attrCount: attrEntries.length
  });
  for (const [name, value] of attrEntries) {
    attributes.push({
      id: `${id}@${name}`,
      index: attributes.length,
      owner: id,
      ownerName: el.name,
      name,
      value
    });
  }
  for (const child of el.children) flattenXml(child, id, depth + 1, nodes, attributes, counters);
}

function collapsePath(path: string): string {
  return path.replace(/\[\d+\]/g, '');
}

function buildSchema(nodes: XmNode[]): XmSchemaEntry[] {
  const map = new Map<string, XmSchemaEntry>();
  for (const node of nodes) {
    const path = collapsePath(node.path);
    const existing = map.get(path);
    if (!existing) {
      map.set(path, {
        id: path,
        index: map.size,
        path,
        name: node.name,
        attrCount: node.attrCount,
        childCount: node.childCount,
        sample: node.text
      });
      continue;
    }
    existing.attrCount = Math.max(existing.attrCount, node.attrCount);
    existing.childCount = Math.max(existing.childCount, node.childCount);
    if (!existing.sample) existing.sample = node.text;
  }
  return [...map.values()].map((e, i) => ({ ...e, index: i }));
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'STRING';
  if (nonEmpty.every((v) => /^(true|false)$/i.test(v))) return 'BOOLEAN';
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))) return 'NUMBER';
  return 'STRING';
}

function extractTable(el: XmlElem): { columns: XmColumn[]; rows: Array<Record<string, string>> } {
  const collections = [el, ...el.children];
  let items: XmlElem[] = [];
  for (const node of collections) {
    if (node.children.length < 2) continue;
    const counts = new Map<string, XmlElem[]>();
    for (const child of node.children) {
      const list = counts.get(child.name) ?? [];
      list.push(child);
      counts.set(child.name, list);
    }
    const repeating = [...counts.values()].filter((list) => list.length >= 2).sort((a, b) => b.length - a.length)[0];
    if (repeating?.length) {
      items = repeating;
      break;
    }
  }
  if (!items.length && el.children.length === 1 && el.children[0].children.length) {
    const only = el.children[0];
    const counts = new Map<string, XmlElem[]>();
    for (const child of only.children) {
      const list = counts.get(child.name) ?? [];
      list.push(child);
      counts.set(child.name, list);
    }
    items = [...counts.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  }
  if (!items.length) return { columns: [], rows: [] };
  const keys: string[] = [];
  const seen = new Set<string>();
  const addKey = (key: string) => {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  };
  for (const item of items) {
    Object.keys(item.attrs).forEach(addKey);
    if (item.text) addKey('#text');
    for (const child of item.children) addKey(child.name);
  }
  const rows: Array<Record<string, string>> = items.map((item) => {
    const row: Record<string, string> = {};
    for (const key of keys) {
      if (key === '#text') row[key] = item.text;
      else if (key in item.attrs) row[key] = item.attrs[key];
      else {
        const child = item.children.find((c) => c.name === key);
        row[key] = child ? child.text || Object.values(child.attrs)[0] || '' : '';
      }
    }
    return row;
  });
  const columns: XmColumn[] = keys.map((name, index) => ({
    id: name,
    index,
    name,
    type: inferColumnType(rows.map((r) => r[name] || ''))
  }));
  return { columns, rows };
}

function xmlDeclEncoding(xml: string): string {
  const m = /<\?xml\b([^?]*)\?>/i.exec(xml);
  if (!m) return 'UTF-8';
  return parseAttrs(m[1]).encoding || 'UTF-8';
}

function finishDataset(
  name: string,
  sourceKind: XmSourceKind,
  title: string,
  encoding: string,
  root: XmlElem,
  warnings: string[]
): XmDataset {
  const nodes: XmNode[] = [];
  const attributes: XmAttribute[] = [];
  flattenXml(root, '', 0, nodes, attributes, new Map());
  if (!nodes.length) throw new Error('XML contains no elements');
  const table = extractTable(root);
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    rootName: root.name,
    nodeCount: nodes.length,
    attrCount: attributes.length,
    maxDepth,
    nodes,
    attributes,
    schema: buildSchema(nodes),
    columns: table.columns,
    rows: table.rows,
    warnings
  };
}

function parseXmlDocument(xml: string, fileName: string): XmDataset {
  const warnings: string[] = [];
  const root = parseXmlTree(xml, warnings);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || root.attrs.name || root.name;
  const name = root.attrs.name || fromFile;
  return finishDataset(name, 'xml', name, xmlDeclEncoding(xml), root, warnings);
}

function ingestJson(raw: unknown, fileName: string): XmDataset {
  const rootObj = rec(Array.isArray(raw) ? { nodes: raw } : raw);
  const name = asString(rootObj.name || rootObj.title || rootObj.root, fileName.replace(/\.[^.]+$/, '') || 'XML document');
  const warnings: string[] = [];
  if (Array.isArray(rootObj.nodes) && rootObj.nodes.length) {
    const nodes: XmNode[] = [];
    const attributes: XmAttribute[] = [];
    rootObj.nodes.forEach((item, i) => {
      const row = rec(item);
      const nodeName = asString(row.name || row.tag || row.element, `node${i + 1}`);
      const path = asString(row.path, `/${nodeName}`);
      const attrs = rec(row.attrs || row.attributes);
      const attrEntries = Object.entries(attrs).map(([k, v]) => [k, String(v ?? '')] as const);
      nodes.push({
        id: path,
        index: i,
        name: nodeName,
        path,
        text: asString(row.text || row.value),
        depth: Math.max(0, path.split('/').filter(Boolean).length - 1),
        childCount: Number(row.childCount || 0) || 0,
        attrCount: attrEntries.length
      });
      attrEntries.forEach(([attrName, value]) => {
        attributes.push({
          id: `${path}@${attrName}`,
          index: attributes.length,
          owner: path,
          ownerName: nodeName,
          name: attrName,
          value
        });
      });
    });
    const rowList = Array.isArray(rootObj.rows) ? rootObj.rows : [];
    const rows: Array<Record<string, string>> = [];
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const item of rowList) {
      const row = rec(item);
      Object.keys(row).forEach((k) => {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      });
      const out: Record<string, string> = {};
      keys.forEach((k) => (out[k] = row[k] == null ? '' : String(row[k])));
      rows.push(out);
    }
    if (!nodes.length) throw new Error('XML JSON contains no nodes');
    return {
      name,
      sourceKind: 'json',
      title: asString(rootObj.title, name),
      encoding: asString(rootObj.encoding, 'UTF-8'),
      rootName: asString(rootObj.root, nodes[0]?.name || 'root'),
      nodeCount: nodes.length,
      attrCount: attributes.length,
      maxDepth: Math.max(0, ...nodes.map((n) => n.depth)),
      nodes,
      attributes,
      schema: buildSchema(nodes),
      columns: keys.map((k, i) => ({ id: k, index: i, name: k, type: inferColumnType(rows.map((r) => r[k] || '')) })),
      rows,
      warnings
    };
  }
  throw new Error('XML JSON contains no nodes');
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

function parseCsvAsXml(text: string, fileName: string): XmDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('XML CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('XML CSV dump contains no schema');
  const root: XmlElem = { name: 'rows', attrs: { name: fileName.replace(/\.[^.]+$/, '') || 'rows' }, text: '', children: [] };
  for (const line of lines.slice(1)) {
    const parts = parseCsvLine(line);
    const attrs: Record<string, string> = {};
    header.forEach((h, i) => (attrs[h] = parts[i] ?? ''));
    root.children.push({ name: 'row', attrs, text: '', children: [] });
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'XML table';
  return finishDataset(name, 'csv', name, 'UTF-8', root, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: XmSourceKind): XmDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'XML table').trim();
  const keys: string[] = [];
  const root: XmlElem = { name: 'rows', attrs: { name }, text: '', children: [] };
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
      const attrs: Record<string, string> = {};
      keys.forEach((k, i) => (attrs[k] = parts[i] || ''));
      root.children.push({ name: 'row', attrs, text: '', children: [] });
    }
  }
  if (!keys.length) throw new Error('XML markdown contains no schema');
  return finishDataset(name, sourceKind, name, 'UTF-8', root, []);
}

export function buildSampleXmlBytes(): Uint8Array {
  return te.encode(XM_XML_SAMPLE);
}

export function parseXmlText(text: string, fileName = ''): XmDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('XML file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid XML JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (looksLikeXml(raw) || ext === 'xml') return parseXmlDocument(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsXml(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an XML dump');
}

export function parseXmlBytes(bytes: Uint8Array, fileName = ''): XmDataset {
  if (!bytes.length) throw new Error('XML file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed XML files are not supported — decompress first');
  return parseXmlText(td.decode(bytes), fileName);
}

export function filterXmNodes(nodes: XmNode[], query: string): XmNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('node:') || token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('path:')) return n.path.toLowerCase().includes(token.slice(5));
      if (token.startsWith('attr:') || token.startsWith('value:')) return true;
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.path} ${n.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterXmAttributes(attrs: XmAttribute[], query: string): XmAttribute[] {
  const q = query.trim().toLowerCase();
  if (!q) return attrs;
  const tokens = q.split(/\s+/).filter(Boolean);
  return attrs.filter((a) =>
    tokens.every((token) => {
      if (token.startsWith('attr:') || token.startsWith('name:')) return a.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('value:')) return a.value.toLowerCase().includes(token.slice(6));
      if (token.startsWith('node:') || token.startsWith('path:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return a.owner.toLowerCase().includes(needle) || a.ownerName.toLowerCase().includes(needle);
      }
      if (token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        return a.name.toLowerCase() === key && a.value.toLowerCase().includes(needle);
      }
      return `${a.name} ${a.value} ${a.owner} ${a.ownerName}`.toLowerCase().includes(token);
    })
  );
}

export function filterXmRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('value:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('node:') || token.startsWith('name:') || token.startsWith('path:') || token.startsWith('attr:')) return true;
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
