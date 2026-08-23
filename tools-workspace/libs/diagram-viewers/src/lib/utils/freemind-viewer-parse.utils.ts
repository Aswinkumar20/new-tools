import type { FmDataset, FmNode, FmSourceKind } from '../types/freemind-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeMm(text: string): boolean {
  return /<(?:[\w.-]+:)?map\b/i.test(text) && /<(?:[\w.-]+:)?node\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:mm|freemind|xml|json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function stripHtml(html: string): string {
  return decodeXml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  );
}

function slugId(label: string, used: Set<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';
  let id = base;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

export function extractMmNodes(xml: string): Array<{ attrStr: string; inner: string }> {
  const out: Array<{ attrStr: string; inner: string }> = [];
  const openRe = /<(?:[\w.-]+:)?node\b([^>]*?)(\/>|>)/i;
  let i = 0;
  while (i < xml.length) {
    const open = openRe.exec(xml.slice(i));
    if (!open) break;
    const abs = i + open.index;
    const attrStr = open[1] || '';
    if (open[2] === '/>') {
      out.push({ attrStr, inner: '' });
      i = abs + open[0].length;
      continue;
    }
    let depth = 1;
    let pos = abs + open[0].length;
    const innerStart = pos;
    while (pos < xml.length && depth > 0) {
      const rest = xml.slice(pos);
      const nextOpen = /<(?:[\w.-]+:)?node\b[^>]*?(\/>|>)/i.exec(rest);
      const nextClose = /<\/(?:[\w.-]+:)?node>/i.exec(rest);
      const openAt = nextOpen ? nextOpen.index : Number.POSITIVE_INFINITY;
      const closeAt = nextClose ? nextClose.index : Number.POSITIVE_INFINITY;
      if (!Number.isFinite(openAt) && !Number.isFinite(closeAt)) {
        out.push({ attrStr, inner: xml.slice(innerStart) });
        return out;
      }
      if (openAt < closeAt) {
        const token = nextOpen as RegExpExecArray;
        pos += token.index + token[0].length;
        if (token[1] !== '/>') depth += 1;
      } else {
        const token = nextClose as RegExpExecArray;
        depth -= 1;
        if (depth === 0) {
          out.push({ attrStr, inner: xml.slice(innerStart, pos + token.index) });
          i = pos + token.index + token[0].length;
          break;
        }
        pos += token.index + token[0].length;
      }
    }
    if (depth !== 0) {
      out.push({ attrStr, inner: xml.slice(innerStart) });
      break;
    }
  }
  return out;
}

function withoutChildNodes(xml: string): string {
  const openRe = /<(?:[\w.-]+:)?node\b([^>]*?)(\/>|>)/i;
  let result = '';
  let i = 0;
  while (i < xml.length) {
    const open = openRe.exec(xml.slice(i));
    if (!open) {
      result += xml.slice(i);
      break;
    }
    result += xml.slice(i, i + open.index);
    const abs = i + open.index;
    if (open[2] === '/>') {
      i = abs + open[0].length;
      continue;
    }
    let depth = 1;
    let pos = abs + open[0].length;
    while (pos < xml.length && depth > 0) {
      const rest = xml.slice(pos);
      const nextOpen = /<(?:[\w.-]+:)?node\b[^>]*?(\/>|>)/i.exec(rest);
      const nextClose = /<\/(?:[\w.-]+:)?node>/i.exec(rest);
      const openAt = nextOpen ? nextOpen.index : Number.POSITIVE_INFINITY;
      const closeAt = nextClose ? nextClose.index : Number.POSITIVE_INFINITY;
      if (!Number.isFinite(openAt) && !Number.isFinite(closeAt)) return result;
      if (openAt < closeAt) {
        const token = nextOpen as RegExpExecArray;
        pos += token.index + token[0].length;
        if (token[1] !== '/>') depth += 1;
      } else {
        const token = nextClose as RegExpExecArray;
        depth -= 1;
        pos += token.index + token[0].length;
      }
    }
    i = pos;
  }
  return result;
}

function extractNote(inner: string): string {
  const direct = withoutChildNodes(inner);
  for (const m of direct.matchAll(/<(?:[\w.-]+:)?richcontent\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?richcontent>/gi)) {
    const type = (attrs(m[1] || '').TYPE || attrs(m[1] || '').type || '').toUpperCase();
    if (!type || type === 'NOTE') return stripHtml(m[2] || '');
  }
  const hook = /<(?:[\w.-]+:)?hook\b[^>]*NAME="NodeNote"[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?hook>/i.exec(direct);
  if (hook) return stripHtml(hook[1] || '');
  return '';
}

function layoutTree(nodes: FmNode[], rootId: string): void {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const walk = (id: string, depth: number, row: { y: number }): number => {
    const node = byId.get(id);
    if (!node) return row.y;
    node.depth = depth;
    node.x = 48 + depth * 160;
    if (node.collapsed || !node.childIds.length) {
      node.y = 40 + row.y * 56;
      row.y += 1;
      if (node.collapsed) return row.y;
      return row.y;
    }
    const start = row.y;
    for (const child of node.childIds) walk(child, depth + 1, row);
    const end = row.y;
    node.y = 40 + ((start + Math.max(start, end - 1)) / 2) * 56;
    if (end === start) {
      node.y = 40 + row.y * 56;
      row.y += 1;
    }
    return row.y;
  };
  walk(rootId, 0, { y: 0 });
  nodes.forEach((n, i) => {
    n.index = i;
  });
}

function finishDataset(name: string, sourceKind: FmSourceKind, version: string, nodes: FmNode[], warnings: string[]): FmDataset {
  if (!nodes.length) throw new Error('FreeMind map contains no nodes');
  const roots = nodes.filter((n) => !n.parentId);
  let rootId = roots[0]?.id || nodes[0].id;
  if (roots.length > 1) {
    const synthetic: FmNode = {
      id: '__root__',
      index: 0,
      label: name || 'FreeMind',
      note: '',
      position: '',
      depth: 0,
      parentId: '',
      childIds: roots.map((r) => r.id),
      collapsed: false,
      x: 0,
      y: 0
    };
    roots.forEach((r) => {
      r.parentId = synthetic.id;
    });
    nodes.unshift(synthetic);
    rootId = synthetic.id;
    warnings.push('Multiple top-level topics were wrapped under a single root.');
  }
  layoutTree(nodes, rootId);
  return { name, sourceKind, version, rootId, nodes, warnings };
}

function parseMmXml(xml: string, fileName: string, sourceKind: FmSourceKind, warnings: string[]): FmDataset {
  const version = attrs(/<(?:[\w.-]+:)?map\b([^>]*)>/i.exec(xml)?.[1] || '').version || '';
  const body = /<(?:[\w.-]+:)?map\b[^>]*>([\s\S]*)<\/(?:[\w.-]+:)?map>/i.exec(xml)?.[1] || xml;
  const used = new Set<string>();
  const nodes: FmNode[] = [];
  const walk = (chunks: Array<{ attrStr: string; inner: string }>, parentId: string): void => {
    for (const chunk of chunks) {
      const a = attrs(chunk.attrStr);
      const label = decodeXml(a.TEXT || a.text || a.LOCALIZED_TEXT || 'Topic');
      const id = a.ID || a.id ? String(a.ID || a.id) : slugId(label, used);
      if (a.ID || a.id) used.add(id);
      else used.add(id);
      const node: FmNode = {
        id,
        index: nodes.length,
        label,
        note: extractNote(chunk.inner),
        position: (a.POSITION || a.position || '').toLowerCase(),
        depth: 0,
        parentId,
        childIds: [],
        collapsed: /^(true|yes)$/i.test(a.FOLDED || a.folded || ''),
        x: 0,
        y: 0
      };
      if (parentId) nodes.find((n) => n.id === parentId)?.childIds.push(node.id);
      nodes.push(node);
      walk(extractMmNodes(chunk.inner), node.id);
    }
  };
  walk(extractMmNodes(body), '');
  if (/<(?:[\w.-]+:)?icon\b/i.test(xml)) warnings.push('Icons are preview-only — open Freeplane Viewer for icon details.');
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'FreeMind';
  return finishDataset(name, sourceKind, version, nodes, warnings);
}

function parseJson(text: string, fileName: string): FmDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid FreeMind JSON');
  }
  const used = new Set<string>();
  const nodes: FmNode[] = [];
  const walk = (item: unknown, parentId: string): void => {
    if (item == null) return;
    if (Array.isArray(item)) {
      item.forEach((child) => walk(child, parentId));
      return;
    }
    const rec = typeof item === 'string' ? { label: item } : (item as Record<string, unknown>);
    const label = asString(rec.label || rec.TEXT || rec.text || rec.name, 'Topic');
    const node: FmNode = {
      id: asString(rec.id || rec.ID) || slugId(label, used),
      index: nodes.length,
      label,
      note: asString(rec.note || rec.NOTE),
      position: asString(rec.position || rec.POSITION).toLowerCase(),
      depth: 0,
      parentId,
      childIds: [],
      collapsed: Boolean(rec.collapsed || rec.folded),
      x: 0,
      y: 0
    };
    used.add(node.id);
    if (parentId) nodes.find((n) => n.id === parentId)?.childIds.push(node.id);
    nodes.push(node);
    const children = rec.children || rec.nodes;
    if (Array.isArray(children)) children.forEach((child) => walk(child, node.id));
  };
  walk(Array.isArray(raw) ? { label: fileName.replace(/\.[^.]+$/, '') || 'FreeMind', children: raw } : raw, '');
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'FreeMind';
  return finishDataset(name, 'json', '', nodes, []);
}

export function parseFreemindText(text: string, fileName = ''): FmDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('FreeMind file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: FmSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xml' : 'mm';
  if (looksLikeJson(extracted.source)) return parseJson(extracted.source, fileName);
  if (looksLikeMm(extracted.source) || ext === 'mm' || ext === 'xml') {
    const parsed = parseMmXml(extracted.source, fileName, sourceKind, []);
    if (!parsed.nodes.length) throw new Error('FreeMind map contains no nodes');
    return parsed;
  }
  throw new Error('Not a FreeMind map');
}

export function parseFreemindBytes(bytes: Uint8Array, fileName = ''): FmDataset {
  if (!bytes.length) throw new Error('FreeMind file is empty');
  return parseFreemindText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function nodeMatchesFmQuery(node: FmNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).filter(Boolean).every((token) => {
    if (token.startsWith('depth:')) return String(node.depth) === token.slice(6);
    if (token.startsWith('note:')) return node.note.toLowerCase().includes(token.slice(5));
    if (token.startsWith('node:') || token.startsWith('label:')) {
      const needle = token.slice(token.indexOf(':') + 1);
      return node.label.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle);
    }
    if (token.startsWith('pos:') || token.startsWith('position:')) return node.position.includes(token.slice(token.indexOf(':') + 1));
    return `${node.id} ${node.label} ${node.note} ${node.position} ${node.depth}`.toLowerCase().includes(token);
  });
}

export function filterFmNodes(nodes: FmNode[], query: string, notesOnly = false): FmNode[] {
  let list = notesOnly ? nodes.filter((n) => !!n.note) : nodes;
  const q = query.trim();
  if (!q) return list;
  return list.filter((n) => nodeMatchesFmQuery(n, q));
}

export function hiddenByFmCollapse(nodes: FmNode[], id: string): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  let cur = byId.get(id);
  while (cur?.parentId) {
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    if (parent.collapsed) return true;
    cur = parent;
  }
  return false;
}

export function visibleFmNodes(nodes: FmNode[], query = '', notesOnly = false): FmNode[] {
  if (notesOnly) return filterFmNodes(nodes, query, true);
  const matches = query.trim() ? nodes.filter((n) => nodeMatchesFmQuery(n, query)) : null;
  const keep = new Set<string>();
  if (matches) {
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    for (const match of matches) {
      let cur: FmNode | undefined = match;
      while (cur) {
        keep.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      const walk = (id: string): void => {
        keep.add(id);
        const node = byId.get(id);
        if (!node || node.collapsed) return;
        for (const child of node.childIds) walk(child);
      };
      walk(match.id);
    }
  }
  return nodes.filter((n) => {
    if (hiddenByFmCollapse(nodes, n.id)) return false;
    if (keep.size && !keep.has(n.id)) return false;
    return true;
  });
}

export function toggleFmCollapsed(dataset: FmDataset, id: string): FmDataset {
  const nodes = dataset.nodes.map((n) =>
    n.id === id && n.childIds.length ? { ...n, collapsed: !n.collapsed, childIds: [...n.childIds] } : { ...n, childIds: [...n.childIds] }
  );
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes };
}

export function setFmCollapsedAll(dataset: FmDataset, collapsed: boolean): FmDataset {
  const nodes = dataset.nodes.map((n) => ({
    ...n,
    childIds: [...n.childIds],
    collapsed: n.childIds.length ? collapsed && n.id !== dataset.rootId : false
  }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes };
}

export function expandFmMatches(dataset: FmDataset, query: string): FmDataset {
  if (!query.trim()) return dataset;
  const matches = new Set(filterFmNodes(dataset.nodes, query).map((n) => n.id));
  if (!matches.size) return dataset;
  const byId = new Map(dataset.nodes.map((n) => [n.id, n] as const));
  const expand = new Set<string>();
  for (const id of matches) {
    let cur = byId.get(id);
    while (cur?.parentId) {
      expand.add(cur.parentId);
      cur = byId.get(cur.parentId);
    }
  }
  const nodes = dataset.nodes.map((n) => ({
    ...n,
    childIds: [...n.childIds],
    collapsed: expand.has(n.id) ? false : n.collapsed
  }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes };
}
