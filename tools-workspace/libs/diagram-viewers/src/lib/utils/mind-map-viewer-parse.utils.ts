import type { MmapDataset, MmapNode, MmapSourceKind } from '../types/mind-map-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeOpml(text: string): boolean {
  return /<(?:opml|outline)\b/i.test(text);
}

function looksLikeMermaid(text: string): boolean {
  return /^\s*mindmap\b/im.test(text) || /```(?:mindmap|mermaid)/i.test(text);
}

function extractFence(text: string): { source: string; lang: string; fenced: boolean } {
  const fence = /```(mindmap|mermaid|markdown|md|opml|xml|json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[2].trim(), lang: (fence[1] || '').toLowerCase(), fenced: true };
  return { source: text.trim(), lang: '', fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function slugId(label: string, used: Set<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';
  let id = base;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

function layoutTree(nodes: MmapNode[], rootId: string): void {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const walk = (id: string, depth: number, row: { y: number }): number => {
    const node = byId.get(id);
    if (!node) return row.y;
    node.depth = depth;
    node.x = 48 + depth * 160;
    if (node.collapsed) {
      node.y = 40 + row.y * 56;
      row.y += 1;
      return row.y;
    }
    if (!node.childIds.length) {
      node.y = 40 + row.y * 56;
      row.y += 1;
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

function finishDataset(name: string, sourceKind: MmapSourceKind, nodes: MmapNode[], warnings: string[]): MmapDataset {
  if (!nodes.length) throw new Error('Mind map contains no nodes');
  const roots = nodes.filter((n) => !n.parentId);
  let rootId = roots[0]?.id || nodes[0].id;
  if (roots.length > 1) {
    const synthetic: MmapNode = {
      id: '__root__',
      index: 0,
      label: name || 'Mind map',
      note: '',
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
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  for (const n of nodes) {
    n.childIds = n.childIds.filter((id) => byId.has(id));
    if (n.parentId && byId.has(n.parentId)) {
      const parent = byId.get(n.parentId) as MmapNode;
      if (!parent.childIds.includes(n.id)) parent.childIds.push(n.id);
    }
  }
  relabelDepth(nodes, rootId, 0);
  layoutTree(nodes, rootId);
  if (nodes.length === 1) warnings.push('Mind map has a single topic.');
  return { name, sourceKind, rootId, nodes, warnings };
}

function relabelDepth(nodes: MmapNode[], rootId: string, depth: number): void {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const walk = (id: string, d: number): void => {
    const node = byId.get(id);
    if (!node) return;
    node.depth = d;
    for (const child of node.childIds) walk(child, d + 1);
  };
  walk(rootId, depth);
}

function parseHeadingMarkdown(source: string, fileName: string, sourceKind: MmapSourceKind): MmapDataset {
  const used = new Set<string>();
  const nodes: MmapNode[] = [];
  const stack: MmapNode[] = [];
  const warnings: string[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(raw);
    if (!heading) {
      if (raw.trim() && nodes.length && !/^```/.test(raw)) {
        const last = nodes[nodes.length - 1];
        last.note = [last.note, raw.trim()].filter(Boolean).join(' ');
      }
      continue;
    }
    const depth = heading[1].length - 1;
    const label = heading[2].trim();
    const node: MmapNode = {
      id: slugId(label, used),
      index: nodes.length,
      label,
      note: '',
      depth,
      parentId: '',
      childIds: [],
      collapsed: false,
      x: 0,
      y: 0
    };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      node.parentId = parent.id;
      parent.childIds.push(node.id);
    }
    stack.push(node);
    nodes.push(node);
  }
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Mind map';
  return finishDataset(name, sourceKind, nodes, warnings);
}

function parseIndented(source: string, fileName: string, sourceKind: MmapSourceKind): MmapDataset {
  const used = new Set<string>();
  const nodes: MmapNode[] = [];
  const stack: Array<{ depth: number; node: MmapNode }> = [];
  for (const raw of source.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indent = /^(\s*)/.exec(raw)?.[1] ?? '';
    const depth = indent.includes('\t') ? indent.split('\t').length - 1 : Math.floor(indent.length / 2);
    const label = raw.trim().replace(/^[-*+]\s+/, '');
    if (!label) continue;
    const node: MmapNode = {
      id: slugId(label, used),
      index: nodes.length,
      label,
      note: '',
      depth,
      parentId: '',
      childIds: [],
      collapsed: false,
      x: 0,
      y: 0
    };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      node.parentId = parent.id;
      parent.childIds.push(node.id);
    }
    stack.push({ depth, node });
    nodes.push(node);
  }
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Mind map';
  return finishDataset(name, sourceKind, nodes, []);
}

function parseMermaidMindmap(source: string, fileName: string): MmapDataset {
  const body = source.replace(/^\s*mindmap\s*$/im, '').trim();
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() && !/^```/.test(l));
  const used = new Set<string>();
  const nodes: MmapNode[] = [];
  const stack: Array<{ indent: number; node: MmapNode }> = [];
  for (const raw of lines) {
    const indent = /^(\s*)/.exec(raw)?.[1].length ?? 0;
    let label = raw.trim().replace(/^[-*+]\s+/, '');
    label = label.replace(/^root\(\((.+)\)\)$/i, '$1').replace(/^\[\[(.+)\]\]$/, '$1').replace(/^\((.+)\)$/, '$1').replace(/^\[(.+)\]$/, '$1');
    if (!label) continue;
    const node: MmapNode = {
      id: slugId(label, used),
      index: nodes.length,
      label,
      note: '',
      depth: 0,
      parentId: '',
      childIds: [],
      collapsed: false,
      x: 0,
      y: 0
    };
    while (stack.length && stack[stack.length - 1].indent >= indent && !(stack.length === 1 && indent === stack[0].indent && nodes.length === 1)) {
      if (stack.length === 1 && indent <= stack[0].indent) break;
      stack.pop();
    }
    if (stack.length && indent > stack[stack.length - 1].indent) {
      const parent = stack[stack.length - 1].node;
      node.parentId = parent.id;
      parent.childIds.push(node.id);
    } else if (stack.length && indent === stack[stack.length - 1].indent && stack.length > 1) {
      stack.pop();
      const parent = stack[stack.length - 1]?.node;
      if (parent) {
        node.parentId = parent.id;
        parent.childIds.push(node.id);
      }
    }
    stack.push({ indent, node });
    nodes.push(node);
  }
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Mind map';
  return finishDataset(name, 'mermaid', nodes, []);
}

function parseOpml(xml: string, fileName: string): MmapDataset {
  const used = new Set<string>();
  const nodes: MmapNode[] = [];
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(xml)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(xml)?.[1] || xml;

  const parseOutlines = (chunk: string, parentId: string): void => {
    const re = /<(?:[\w.-]+:)?outline\b([^>]*?)\/>|<(?:[\w.-]+:)?outline\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?outline>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(chunk))) {
      const a = attrs(match[1] || match[2] || '');
      const inner = match[3] || '';
      const label = a.text || a.title || a._text || 'Topic';
      const node: MmapNode = {
        id: slugId(label, used),
        index: nodes.length,
        label,
        note: a._note || a.note || '',
        depth: 0,
        parentId,
        childIds: [],
        collapsed: false,
        x: 0,
        y: 0
      };
      if (parentId) {
        const parent = nodes.find((n) => n.id === parentId);
        parent?.childIds.push(node.id);
      }
      nodes.push(node);
      if (inner.trim()) parseOutlines(inner, node.id);
    }
  };
  parseOutlines(body, '');
  const name = title || nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Mind map';
  return finishDataset(name, /<opml\b/i.test(xml) ? 'opml' : 'xml', nodes, []);
}

function parseJsonTree(text: string, fileName: string): MmapDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid mind map JSON');
  }
  const used = new Set<string>();
  const nodes: MmapNode[] = [];
  const walk = (item: unknown, parentId: string): void => {
    if (item == null) return;
    if (Array.isArray(item)) {
      item.forEach((child) => walk(child, parentId));
      return;
    }
    if (typeof item === 'string') {
      const node: MmapNode = {
        id: slugId(item, used),
        index: nodes.length,
        label: item,
        note: '',
        depth: 0,
        parentId,
        childIds: [],
        collapsed: false,
        x: 0,
        y: 0
      };
      if (parentId) nodes.find((n) => n.id === parentId)?.childIds.push(node.id);
      nodes.push(node);
      return;
    }
    const rec = item as Record<string, unknown>;
    const label = asString(rec.label || rec.title || rec.name || rec.text, 'Topic');
    const node: MmapNode = {
      id: asString(rec.id) || slugId(label, used),
      index: nodes.length,
      label,
      note: asString(rec.note || rec.description),
      depth: 0,
      parentId,
      childIds: [],
      collapsed: false,
      x: 0,
      y: 0
    };
    if (used.has(node.id) && !asString(rec.id)) node.id = slugId(label, used);
    else used.add(node.id);
    if (parentId) nodes.find((n) => n.id === parentId)?.childIds.push(node.id);
    nodes.push(node);
    const children = rec.children || rec.nodes || rec.topics;
    if (Array.isArray(children)) children.forEach((child) => walk(child, node.id));
  };
  const root = Array.isArray(raw) ? { label: fileName.replace(/\.[^.]+$/, '') || 'Mind map', children: raw } : raw;
  walk(root, '');
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Mind map';
  return finishDataset(name, 'json', nodes, []);
}

export function parseMindMapText(text: string, fileName = ''): MmapDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Mind map file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJsonTree(raw, fileName);
  if (looksLikeOpml(raw) || ext === 'opml' || (ext === 'xml' && looksLikeOpml(raw))) return parseOpml(raw, fileName);
  const extracted = extractFence(raw);
  if (looksLikeJson(extracted.source)) return parseJsonTree(extracted.source, fileName);
  if (looksLikeOpml(extracted.source)) return parseOpml(extracted.source, fileName);
  if (looksLikeMermaid(raw) || looksLikeMermaid(extracted.source) || extracted.lang === 'mindmap' || extracted.lang === 'mermaid' || ext === 'mmd') {
    return parseMermaidMindmap(extracted.source || raw.replace(/```/g, ''), fileName);
  }
  const sourceKind: MmapSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'markdown';
  if (/^#{1,6}\s+/m.test(extracted.source) || ext === 'md') return parseHeadingMarkdown(extracted.source, fileName, sourceKind);
  if (extracted.source.split(/\r?\n/).some((l) => /^\s+\S/.test(l))) return parseIndented(extracted.source, fileName, sourceKind);
  if (extracted.source.split(/\r?\n/).filter((l) => l.trim()).length >= 1 && ext === 'txt') {
    return parseIndented(extracted.source, fileName, 'txt');
  }
  throw new Error('Not a mind map');
}

export function parseMindMapBytes(bytes: Uint8Array, fileName = ''): MmapDataset {
  if (!bytes.length) throw new Error('Mind map file is empty');
  return parseMindMapText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function nodeMatchesQuery(node: MmapNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).filter(Boolean).every((token) => {
    if (token.startsWith('depth:')) return String(node.depth) === token.slice(6);
    if (token.startsWith('node:') || token.startsWith('label:')) {
      const needle = token.slice(token.indexOf(':') + 1);
      return node.label.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle);
    }
    if (token.startsWith('note:')) return node.note.toLowerCase().includes(token.slice(5));
    return `${node.id} ${node.label} ${node.note} ${node.depth}`.toLowerCase().includes(token);
  });
}

export function filterMmapNodes(nodes: MmapNode[], query: string): MmapNode[] {
  const q = query.trim();
  if (!q) return nodes;
  return nodes.filter((n) => nodeMatchesQuery(n, q));
}

export function hiddenByCollapse(nodes: MmapNode[], id: string): boolean {
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

export function visibleMmapNodes(nodes: MmapNode[], query = ''): MmapNode[] {
  const matches = query.trim() ? nodes.filter((n) => nodeMatchesQuery(n, query)) : null;
  const keep = new Set<string>();
  if (matches) {
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    for (const match of matches) {
      let cur: MmapNode | undefined = match;
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
    if (hiddenByCollapse(nodes, n.id)) return false;
    if (keep.size && !keep.has(n.id)) return false;
    return true;
  });
}

export function toggleMmapCollapsed(dataset: MmapDataset, id: string): MmapDataset {
  const nodes = dataset.nodes.map((n) => (n.id === id && n.childIds.length ? { ...n, collapsed: !n.collapsed } : { ...n, childIds: [...n.childIds] }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes };
}

export function setMmapCollapsedAll(dataset: MmapDataset, collapsed: boolean): MmapDataset {
  const nodes = dataset.nodes.map((n) => ({
    ...n,
    childIds: [...n.childIds],
    collapsed: n.childIds.length ? collapsed && n.id !== dataset.rootId : false
  }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes };
}

export function expandMmapMatches(dataset: MmapDataset, query: string): MmapDataset {
  if (!query.trim()) return dataset;
  const matches = new Set(filterMmapNodes(dataset.nodes, query).map((n) => n.id));
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
