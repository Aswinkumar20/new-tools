import type { CmapDataset, CmapLink, CmapNode, CmapSourceKind } from '../types/concept-map-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:cmap|concept-map|conceptmap|map|concept-list|concept)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:cmap|concept[- ]?map|dot|xml|json)?\s*([\s\S]*?)```/i.exec(text);
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

function slugId(label: string, fallback: string): string {
  const id = unquote(label).replace(/\s+/g, '');
  return id || fallback;
}

function upsertNode(nodes: CmapNode[], next: { id: string; label: string; note?: string }): CmapNode {
  const existing = nodes.find((n) => n.id === next.id);
  if (existing) {
    if (next.label && next.label !== next.id) existing.label = next.label;
    if (next.note) existing.note = next.note;
    return existing;
  }
  const created: CmapNode = {
    id: next.id,
    index: nodes.length,
    label: next.label || next.id,
    note: next.note || '',
    x: 0,
    y: 0
  };
  nodes.push(created);
  return created;
}

function layoutNodes(nodes: CmapNode[], links: CmapLink[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const l of links) {
    outgoing.get(l.source)?.push(l.target);
    incoming.get(l.target)?.push(l.source);
  }
  const rank = new Map<string, number>();
  const starts = nodes.filter((n) => !(incoming.get(n.id)?.length)).map((n) => n.id);
  (starts.length ? starts : nodes.slice(0, 1).map((n) => n.id)).forEach((id) => rank.set(id, 0));
  const queue = [...rank.keys()];
  while (queue.length) {
    const id = queue.shift() as string;
    const r = rank.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      if (!rank.has(next)) {
        rank.set(next, r + 1);
        queue.push(next);
      }
    }
  }
  const buckets = new Map<number, CmapNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 56 + r * 180;
      n.y = 48 + i * 96;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: CmapSourceKind,
  title: string,
  nodes: CmapNode[],
  links: CmapLink[],
  warnings: string[]
): CmapDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.label] as const));
  links.forEach((l, i) => {
    l.index = i;
    l.sourceName = nameById.get(l.source) || l.source;
    l.targetName = nameById.get(l.target) || l.target;
  });
  nodes.forEach((n, i) => {
    n.index = i;
  });
  layoutNodes(nodes, links);
  if (!nodes.length) warnings.push('Concept map contains no nodes.');
  if (!links.length && nodes.length) warnings.push('Concept map has nodes but no links.');
  return { name, sourceKind, title: title || name, nodes, links, warnings };
}

function parseCxlOrXml(xml: string, fileName: string): CmapDataset {
  const titleTag = /<(?:dc:)?title[^>]*>([^<]+)<\/(?:dc:)?title>/i.exec(xml);
  const root = /<(?:cmap|concept-map|conceptmap)\b([^>]*)>/i.exec(xml);
  const name =
    titleTag?.[1]?.trim() ||
    attrs(root?.[1] || '').name ||
    fileName.replace(/\.[^.]+$/, '') ||
    'Concept map';

  const concepts = new Map<string, { label: string; note: string }>();
  const phrases = new Map<string, string>();
  const connections: Array<{ from: string; to: string }> = [];
  const nodes: CmapNode[] = [];
  const links: CmapLink[] = [];

  for (const m of xml.matchAll(/<(?:[\w.-]+:)?concept\b([^>]*?)\/>|<(?:[\w.-]+:)?concept\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?concept>/gi)) {
    const a = attrs(m[1] || m[2] || '');
    const id = a.id || a.label || `n-${concepts.size + 1}`;
    const note = a.note || a.description || '';
    concepts.set(id, { label: a.label || a.name || id, note });
  }
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?linking-phrase\b([^>]*?)\/>|<(?:[\w.-]+:)?linking-phrase\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?linking-phrase>/gi)) {
    const a = attrs(m[1] || m[2] || '');
    const id = a.id || `p-${phrases.size + 1}`;
    phrases.set(id, a.label || a.name || '');
  }
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?(?:connection|link)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:connection|link)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:connection|link)>/gi)) {
    const a = attrs(m[1] || m[2] || '');
    const from = a['from-id'] || a.from || a.source || '';
    const to = a['to-id'] || a.to || a.target || '';
    if (from && to) connections.push({ from, to });
  }

  if (concepts.size || phrases.size) {
    for (const [id, rec] of concepts) upsertNode(nodes, { id, label: rec.label, note: rec.note });
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    for (const id of phrases.keys()) {
      incoming.set(id, []);
      outgoing.set(id, []);
    }
    for (const c of connections) {
      if (phrases.has(c.to) && concepts.has(c.from)) incoming.get(c.to)?.push(c.from);
      else if (phrases.has(c.from) && concepts.has(c.to)) outgoing.get(c.from)?.push(c.to);
      else if (concepts.has(c.from) && concepts.has(c.to)) {
        links.push({
          id: `l-${links.length + 1}`,
          index: links.length,
          source: c.from,
          target: c.to,
          sourceName: '',
          targetName: '',
          label: ''
        });
      }
    }
    for (const [phraseId, label] of phrases) {
      const froms = incoming.get(phraseId) ?? [];
      const tos = outgoing.get(phraseId) ?? [];
      for (const source of froms) {
        for (const target of tos) {
          links.push({
            id: `l-${links.length + 1}`,
            index: links.length,
            source,
            target,
            sourceName: '',
            targetName: '',
            label
          });
        }
      }
    }
    if (!nodes.length) throw new Error('Concept map XML contains no nodes');
    return finishDataset(name, 'cxl', name, nodes, links, []);
  }

  for (const m of xml.matchAll(/<(?:[\w.-]+:)?node\b([^>]*?)\/>|<(?:[\w.-]+:)?node\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?node>/gi)) {
    const a = attrs(m[1] || m[2] || '');
    const id = a.id || a.label || a.name || `n-${nodes.length + 1}`;
    upsertNode(nodes, { id, label: a.label || a.name || id, note: a.note || '' });
  }
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?(?:link|edge)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:link|edge)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:link|edge)>/gi)) {
    const a = attrs(m[1] || m[2] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertNode(nodes, { id: source, label: source });
    upsertNode(nodes, { id: target, label: target });
    links.push({
      id: `l-${links.length + 1}`,
      index: links.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: a.label || a.relation || a.name || ''
    });
  }
  if (!nodes.length) throw new Error('Concept map XML contains no nodes');
  return finishDataset(name, 'xml', name, nodes, links, []);
}

function parseJson(text: string, fileName: string): CmapDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid concept map JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Concept map JSON must be an object');
  const nodeRaw = (Array.isArray(obj.nodes)
    ? obj.nodes
    : Array.isArray(obj.concepts)
      ? obj.concepts
      : []) as unknown[];
  if (!nodeRaw.length) throw new Error('Concept map JSON is missing nodes');
  const nodes: CmapNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id || rec.label || rec.name, `n-${i + 1}`),
      index: i,
      label: asString(rec.label || rec.name || rec.id, `n-${i + 1}`),
      note: asString(rec.note || rec.description),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const linkRaw = (Array.isArray(obj.links)
    ? obj.links
    : Array.isArray(obj.edges)
      ? obj.edges
      : Array.isArray(obj.relations)
        ? obj.relations
        : []) as unknown[];
  const links: CmapLink[] = linkRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `l-${i + 1}`),
        index: i,
        source: asString(rec.source || rec.from),
        target: asString(rec.target || rec.to),
        sourceName: '',
        targetName: '',
        label: asString(rec.label || rec.relation)
      };
    })
    .filter((l) => l.source && l.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Concept map JSON'),
    'json',
    asString(obj.title || obj.name),
    nodes,
    links,
    []
  );
}

function parseLinkLine(line: string): { left: string; right: string; label: string } | null {
  const relArrow = /^(.+?)\s+--\s*(.+?)\s*-->\s*(.+)$/.exec(line);
  if (relArrow) return { left: unquote(relArrow[1]), label: unquote(relArrow[2]), right: unquote(relArrow[3]) };
  const labeled = /^(.*?)\s*(?:->|-->|--)\s*(.+?)\s*:\s*(.+)$/.exec(line);
  if (labeled) return { left: unquote(labeled[1]), right: unquote(labeled[2]), label: unquote(labeled[3]) };
  const plain = /^(.*?)\s*(?:->|-->)\s*(.+)$/.exec(line);
  if (plain) return { left: unquote(plain[1]), right: unquote(plain[2]), label: '' };
  return null;
}

function parseTextMap(source: string, fileName: string, sourceKind: CmapSourceKind): CmapDataset {
  const warnings: string[] = [];
  let title = '';
  const nodes: CmapNode[] = [];
  const links: CmapLink[] = [];
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%') && !/^digraph\b|^graph\b|^}\s*$/i.test(l));
  for (const line of lines) {
    const heading = /^#+\s+(.+)$/.exec(line);
    if (heading) {
      title = heading[1].trim();
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const dot = /^(.+?)\s*->\s*(.+?)\s*\[label\s*=\s*"([^"]*)"\]\s*;?$/i.exec(line);
    if (dot) {
      const left = slugId(dot[1], `n-${nodes.length + 1}`);
      const right = slugId(dot[2], `n-${nodes.length + 2}`);
      upsertNode(nodes, { id: left, label: unquote(dot[1]) });
      upsertNode(nodes, { id: right, label: unquote(dot[2]) });
      links.push({
        id: `l-${links.length + 1}`,
        index: links.length,
        source: left,
        target: right,
        sourceName: '',
        targetName: '',
        label: dot[3]
      });
      continue;
    }
    const rel = parseLinkLine(line.replace(/;+$/, ''));
    if (rel) {
      const left = slugId(rel.left, `n-${nodes.length + 1}`);
      const right = slugId(rel.right, `n-${nodes.length + 2}`);
      upsertNode(nodes, { id: left, label: rel.left });
      upsertNode(nodes, { id: right, label: rel.right });
      links.push({
        id: `l-${links.length + 1}`,
        index: links.length,
        source: left,
        target: right,
        sourceName: '',
        targetName: '',
        label: rel.label
      });
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Concept map';
  return finishDataset(fallback, sourceKind, title, nodes, links, warnings);
}

export function parseConceptMapText(text: string, fileName = ''): CmapDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Concept map file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || ext === 'cxl' || ext === 'cmap' || (ext === 'xml' && looksLikeXml(raw))) {
    return parseCxlOrXml(raw, fileName);
  }
  const extracted = extractFence(raw);
  const sourceKind: CmapSourceKind =
    extracted.fenced || ext === 'md'
      ? 'markdown'
      : ext === 'dot' || /^digraph\b/i.test(extracted.source)
        ? 'dot'
        : 'txt';
  const parsed = parseTextMap(extracted.source, fileName, sourceKind);
  if (!parsed.nodes.length) throw new Error('Not a concept map');
  return parsed;
}

export function parseConceptMapBytes(bytes: Uint8Array, fileName = ''): CmapDataset {
  if (!bytes.length) throw new Error('Concept map file is empty');
  return parseConceptMapText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterCmapNodes(nodes: CmapNode[], query: string): CmapNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('node:') || token.startsWith('concept:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.label.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      return `${n.id} ${n.label} ${n.note}`.toLowerCase().includes(token);
    })
  );
}

export function filterCmapLinks(links: CmapLink[], query: string): CmapLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return links;
  const tokens = q.split(/\s+/).filter(Boolean);
  return links.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('label:')) return l.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return l.sourceName.toLowerCase().includes(token.slice(5)) || l.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return l.targetName.toLowerCase().includes(token.slice(3)) || l.target.toLowerCase().includes(token.slice(3));
      return `${l.source} ${l.target} ${l.sourceName} ${l.targetName} ${l.label}`.toLowerCase().includes(token);
    })
  );
}
