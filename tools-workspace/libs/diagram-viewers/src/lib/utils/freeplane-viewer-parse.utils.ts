import type { FpAttribute, FpDataset, FpIconGroup, FpNode, FpSourceKind } from '../types/freeplane-viewer.types';

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
  const fence = /```(?:mm|freeplane|xml|json)?\s*([\s\S]*?)```/i.exec(text);
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

export function extractFpNodes(xml: string): Array<{ attrStr: string; inner: string }> {
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
  return '';
}

function extractIcons(inner: string): string[] {
  const icons: string[] = [];
  for (const m of withoutChildNodes(inner).matchAll(/<(?:[\w.-]+:)?icon\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const name = a.BUILTIN || a.builtin || a.NAME || a.name || '';
    if (name) icons.push(name);
  }
  return icons;
}

function extractAttributes(inner: string): FpAttribute[] {
  const out: FpAttribute[] = [];
  for (const m of withoutChildNodes(inner).matchAll(/<(?:[\w.-]+:)?attribute\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const name = a.NAME || a.name || '';
    if (!name) continue;
    out.push({ name, value: decodeXml(a.VALUE || a.value || '') });
  }
  return out;
}

function layoutTree(nodes: FpNode[], rootId: string): void {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const walk = (id: string, depth: number, row: { y: number }): number => {
    const node = byId.get(id);
    if (!node) return row.y;
    node.depth = depth;
    node.x = 48 + depth * 170;
    if (node.collapsed || !node.childIds.length) {
      node.y = 40 + row.y * 60;
      row.y += 1;
      return row.y;
    }
    const start = row.y;
    for (const child of node.childIds) walk(child, depth + 1, row);
    const end = row.y;
    node.y = 40 + ((start + Math.max(start, end - 1)) / 2) * 60;
    if (end === start) {
      node.y = 40 + row.y * 60;
      row.y += 1;
    }
    return row.y;
  };
  walk(rootId, 0, { y: 0 });
  nodes.forEach((n, i) => {
    n.index = i;
  });
}

function buildIconGroups(nodes: FpNode[]): FpIconGroup[] {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    for (const icon of n.icons) {
      const list = map.get(icon) ?? [];
      list.push(n.id);
      map.set(icon, list);
    }
  }
  return [...map.entries()].map(([name, nodeIds], i) => ({
    id: `icon-${i + 1}`,
    index: i,
    name,
    count: nodeIds.length,
    nodeIds
  }));
}

function finishDataset(name: string, sourceKind: FpSourceKind, version: string, nodes: FpNode[], warnings: string[]): FpDataset {
  if (!nodes.length) throw new Error('Freeplane map contains no nodes');
  const roots = nodes.filter((n) => !n.parentId);
  let rootId = roots[0]?.id || nodes[0].id;
  if (roots.length > 1) {
    const synthetic: FpNode = {
      id: '__root__',
      index: 0,
      label: name || 'Freeplane',
      note: '',
      icons: [],
      attributes: [],
      color: '',
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
  const icons = buildIconGroups(nodes);
  if (!icons.length) warnings.push('No icons in this Freeplane map.');
  if (nodes.some((n) => n.note)) warnings.push('Notes are listed — open FreeMind Viewer for note-focused review.');
  return { name, sourceKind, version, rootId, nodes, icons, warnings };
}

function parseMmXml(xml: string, fileName: string, sourceKind: FpSourceKind, warnings: string[]): FpDataset {
  const version = attrs(/<(?:[\w.-]+:)?map\b([^>]*)>/i.exec(xml)?.[1] || '').version || '';
  const body = /<(?:[\w.-]+:)?map\b[^>]*>([\s\S]*)<\/(?:[\w.-]+:)?map>/i.exec(xml)?.[1] || xml;
  const used = new Set<string>();
  const nodes: FpNode[] = [];
  const walk = (chunks: Array<{ attrStr: string; inner: string }>, parentId: string): void => {
    for (const chunk of chunks) {
      const a = attrs(chunk.attrStr);
      const label = decodeXml(a.TEXT || a.text || a.LOCALIZED_TEXT || 'Topic');
      const id = a.ID || a.id ? String(a.ID || a.id) : slugId(label, used);
      used.add(id);
      const node: FpNode = {
        id,
        index: nodes.length,
        label,
        note: extractNote(chunk.inner),
        icons: extractIcons(chunk.inner),
        attributes: extractAttributes(chunk.inner),
        color: a.COLOR || a.color || '',
        depth: 0,
        parentId,
        childIds: [],
        collapsed: /^(true|yes)$/i.test(a.FOLDED || a.folded || ''),
        x: 0,
        y: 0
      };
      if (parentId) nodes.find((n) => n.id === parentId)?.childIds.push(node.id);
      nodes.push(node);
      walk(extractFpNodes(chunk.inner), node.id);
    }
  };
  walk(extractFpNodes(body), '');
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Freeplane';
  return finishDataset(name, sourceKind, version, nodes, warnings);
}

function parseJson(text: string, fileName: string): FpDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Freeplane JSON');
  }
  const used = new Set<string>();
  const nodes: FpNode[] = [];
  const walk = (item: unknown, parentId: string): void => {
    if (item == null) return;
    if (Array.isArray(item)) {
      item.forEach((child) => walk(child, parentId));
      return;
    }
    const rec = typeof item === 'string' ? { label: item } : (item as Record<string, unknown>);
    const label = asString(rec.label || rec.TEXT || rec.text || rec.name, 'Topic');
    const attrRaw = Array.isArray(rec.attributes) ? rec.attributes : [];
    const node: FpNode = {
      id: asString(rec.id || rec.ID) || slugId(label, used),
      index: nodes.length,
      label,
      note: asString(rec.note),
      icons: Array.isArray(rec.icons) ? rec.icons.map((x) => asString(x)).filter(Boolean) : [],
      attributes: attrRaw
        .map((entry) => {
          const recA = (entry ?? {}) as Record<string, unknown>;
          return { name: asString(recA.name || recA.NAME), value: asString(recA.value || recA.VALUE) };
        })
        .filter((a) => a.name),
      color: asString(rec.color || rec.COLOR),
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
  walk(Array.isArray(raw) ? { label: fileName.replace(/\.[^.]+$/, '') || 'Freeplane', children: raw } : raw, '');
  const name = nodes[0]?.label || fileName.replace(/\.[^.]+$/, '') || 'Freeplane';
  return finishDataset(name, 'json', '', nodes, []);
}

export function parseFreeplaneText(text: string, fileName = ''): FpDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Freeplane file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: FpSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xml' : 'mm';
  if (looksLikeJson(extracted.source)) return parseJson(extracted.source, fileName);
  if (looksLikeMm(extracted.source) || ext === 'mm' || ext === 'xml') {
    const parsed = parseMmXml(extracted.source, fileName, sourceKind, []);
    if (!parsed.nodes.length) throw new Error('Freeplane map contains no nodes');
    return parsed;
  }
  throw new Error('Not a Freeplane map');
}

export function parseFreeplaneBytes(bytes: Uint8Array, fileName = ''): FpDataset {
  if (!bytes.length) throw new Error('Freeplane file is empty');
  return parseFreeplaneText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function nodeMatchesFpQuery(node: FpNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).filter(Boolean).every((token) => {
    if (token.startsWith('depth:')) return String(node.depth) === token.slice(6);
    if (token.startsWith('icon:')) return node.icons.some((icon) => icon.toLowerCase().includes(token.slice(5)));
    if (token.startsWith('attr:') || token.startsWith('attribute:')) {
      const needle = token.slice(token.indexOf(':') + 1);
      return node.attributes.some((a) => `${a.name} ${a.value}`.toLowerCase().includes(needle));
    }
    if (token.startsWith('node:') || token.startsWith('label:')) {
      const needle = token.slice(token.indexOf(':') + 1);
      return node.label.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle);
    }
    return `${node.id} ${node.label} ${node.note} ${node.icons.join(' ')} ${node.attributes.map((a) => `${a.name}=${a.value}`).join(' ')} ${node.depth}`.toLowerCase().includes(token);
  });
}

export function filterFpNodes(nodes: FpNode[], query: string, icon = ''): FpNode[] {
  let list = icon ? nodes.filter((n) => n.icons.includes(icon) || n.icons.some((i) => i.toLowerCase() === icon.toLowerCase())) : nodes;
  const q = query.trim();
  if (!q) return list;
  return list.filter((n) => nodeMatchesFpQuery(n, q));
}

export function hiddenByFpCollapse(nodes: FpNode[], id: string): boolean {
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

export function visibleFpNodes(nodes: FpNode[], query = ''): FpNode[] {
  const matches = query.trim() ? nodes.filter((n) => nodeMatchesFpQuery(n, query)) : null;
  const keep = new Set<string>();
  if (matches) {
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    for (const match of matches) {
      let cur: FpNode | undefined = match;
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
    if (hiddenByFpCollapse(nodes, n.id)) return false;
    if (keep.size && !keep.has(n.id)) return false;
    return true;
  });
}

export function toggleFpCollapsed(dataset: FpDataset, id: string): FpDataset {
  const nodes = dataset.nodes.map((n) =>
    n.id === id && n.childIds.length
      ? { ...n, collapsed: !n.collapsed, childIds: [...n.childIds], icons: [...n.icons], attributes: n.attributes.map((a) => ({ ...a })) }
      : { ...n, childIds: [...n.childIds], icons: [...n.icons], attributes: n.attributes.map((a) => ({ ...a })) }
  );
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes, icons: buildIconGroups(nodes) };
}

export function setFpCollapsedAll(dataset: FpDataset, collapsed: boolean): FpDataset {
  const nodes = dataset.nodes.map((n) => ({
    ...n,
    childIds: [...n.childIds],
    icons: [...n.icons],
    attributes: n.attributes.map((a) => ({ ...a })),
    collapsed: n.childIds.length ? collapsed && n.id !== dataset.rootId : false
  }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes, icons: buildIconGroups(nodes) };
}

export function expandFpMatches(dataset: FpDataset, query: string): FpDataset {
  if (!query.trim()) return dataset;
  const matches = new Set(filterFpNodes(dataset.nodes, query).map((n) => n.id));
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
    icons: [...n.icons],
    attributes: n.attributes.map((a) => ({ ...a })),
    collapsed: expand.has(n.id) ? false : n.collapsed
  }));
  layoutTree(nodes, dataset.rootId);
  return { ...dataset, nodes, icons: buildIconGroups(nodes) };
}
