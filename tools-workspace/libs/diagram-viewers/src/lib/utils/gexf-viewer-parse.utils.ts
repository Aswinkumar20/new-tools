import type { GxfCommunity, GxfDataset, GxfEdge, GxfNode, GxfSourceKind } from '../types/gexf-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeGexf(text: string): boolean {
  return /<(?:[\w.-]+:)?(gexf|graph|node|edge)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:gexf|xml|json)?\s*([\s\S]*?)```/i.exec(text);
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

function innerText(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributeDefs(xml: string): { node: Map<string, string>; edge: Map<string, string> } {
  const node = new Map<string, string>();
  const edge = new Map<string, string>();
  for (const block of xml.matchAll(/<(?:[\w.-]+:)?attributes\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?attributes>/gi)) {
    const klass = (attrs(block[1] || '').class || 'node').toLowerCase();
    const target = klass === 'edge' ? edge : node;
    for (const m of (block[2] || '').matchAll(/<(?:[\w.-]+:)?attribute\b([^>]*)\/?>/gi)) {
      const a = attrs(m[1] || '');
      if (a.id) target.set(a.id, (a.title || a.name || a.id).toLowerCase());
    }
  }
  return { node, edge };
}

function attValues(inner: string, defs: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of inner.matchAll(/<(?:[\w.-]+:)?attvalue\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const key = defs.get(a.for || a.id || '') || (a.for || a.id || 'value').toLowerCase();
    out[key] = a.value || '';
  }
  return out;
}

function spellRange(inner: string, fallbackStart: string, fallbackEnd: string): { start: string; end: string } {
  const spell = /<(?:[\w.-]+:)?spell\b([^>]*)\/?>/i.exec(inner);
  if (!spell) return { start: fallbackStart, end: fallbackEnd };
  const a = attrs(spell[1] || '');
  return { start: a.start || fallbackStart, end: a.end || fallbackEnd };
}

function communityValue(data: Record<string, string>): string {
  return data.community || data.group || data.cluster || data.modularity_class || data.modularityclass || '';
}

export function isGxfActive(start: string, end: string, time: number | null): boolean {
  if (time == null || !Number.isFinite(time)) return true;
  const s = start === '' || start == null ? Number.NEGATIVE_INFINITY : Number(start);
  const e = end === '' || end == null ? Number.POSITIVE_INFINITY : Number(end);
  const startN = Number.isFinite(s) ? s : Number.NEGATIVE_INFINITY;
  const endN = Number.isFinite(e) ? e : Number.POSITIVE_INFINITY;
  return startN <= time && time <= endN;
}

function connectedCommunities(nodes: GxfNode[], edges: GxfEdge[]): void {
  const parent = new Map<string, string>();
  for (const n of nodes) parent.set(n.id, n.id);
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) !== cur) cur = parent.get(cur) as string;
    return cur;
  };
  for (const e of edges) {
    if (!parent.has(e.source) || !parent.has(e.target)) continue;
    const a = find(e.source);
    const b = find(e.target);
    if (a !== b) parent.set(a, b);
  }
  const labels = new Map<string, string>();
  let i = 0;
  for (const n of nodes) {
    const root = find(n.id);
    if (!labels.has(root)) labels.set(root, `c${++i}`);
    n.community = labels.get(root) as string;
  }
}

function buildCommunities(nodes: GxfNode[]): GxfCommunity[] {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    const name = n.community || 'default';
    n.community = name;
    const list = map.get(name) ?? [];
    list.push(n.id);
    map.set(name, list);
  }
  return [...map.entries()].map(([name, nodeIds], i) => ({
    id: `comm-${i + 1}`,
    index: i,
    name,
    size: nodeIds.length,
    nodeIds
  }));
}

function layoutNodes(nodes: GxfNode[], edges: GxfEdge[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
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
  const buckets = new Map<number, GxfNode[]>();
  for (const n of nodes) {
    n.rank = rank.get(n.id) ?? 0;
    const list = buckets.get(n.rank) ?? [];
    list.push(n);
    buckets.set(n.rank, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 56 + r * 150;
      n.y = 48 + i * 80;
    });
  }
}

function collectTicks(nodes: GxfNode[], edges: GxfEdge[]): number[] {
  const set = new Set<number>();
  for (const item of [...nodes, ...edges]) {
    const s = Number(item.start);
    const e = Number(item.end);
    if (Number.isFinite(s)) set.add(s);
    if (Number.isFinite(e)) set.add(e);
  }
  return [...set].sort((a, b) => a - b);
}

function finishDataset(
  name: string,
  sourceKind: GxfSourceKind,
  directed: boolean,
  mode: 'static' | 'dynamic',
  nodes: GxfNode[],
  edges: GxfEdge[],
  warnings: string[],
  inferredCommunities: boolean
): GxfDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.label] as const));
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  });
  nodes.forEach((n, i) => {
    n.index = i;
  });
  const missing = nodes.some((n) => !n.community);
  if (missing) {
    connectedCommunities(nodes, edges);
    inferredCommunities = true;
  }
  const communities = buildCommunities(nodes);
  layoutNodes(nodes, edges);
  const ticks = collectTicks(nodes, edges);
  const timeMin = ticks.length ? ticks[0] : 0;
  const timeMax = ticks.length ? ticks[ticks.length - 1] : 0;
  if (!nodes.length) warnings.push('GEXF contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('GEXF has nodes but no edges.');
  if (inferredCommunities) warnings.push('Communities were inferred from connected components.');
  if (mode === 'dynamic' && !ticks.length) warnings.push('Dynamic GEXF has no start/end times.');
  return { name, sourceKind, directed, mode, timeMin, timeMax, ticks, nodes, edges, communities, warnings };
}

function parseGexfXml(xml: string, fileName: string, sourceKind: GxfSourceKind): GxfDataset {
  const defs = parseAttributeDefs(xml);
  const graphTag = /<(?:[\w.-]+:)?graph\b([^>]*)>/i.exec(xml);
  const gAttrs = attrs(graphTag?.[1] || '');
  const directed = (gAttrs.defaultedgetype || gAttrs.edgedefault || '').toLowerCase() === 'directed';
  const mode: 'static' | 'dynamic' = (gAttrs.mode || '').toLowerCase() === 'dynamic' ? 'dynamic' : 'static';
  const metaDesc = /<(?:[\w.-]+:)?description\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?description>/i.exec(xml);
  const name = innerText(metaDesc?.[1] || '') || gAttrs.id || fileName.replace(/\.[^.]+$/, '') || 'GEXF';
  const nodes: GxfNode[] = [];
  const nodeRe =
    /<(?:[\w.-]+:)?node\b([^>]*?)\/>|<(?:[\w.-]+:)?node\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?node>/gi;
  let match: RegExpExecArray | null;
  while ((match = nodeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const id = a.id || `n-${nodes.length + 1}`;
    const data = attValues(inner, defs.node);
    const range = spellRange(inner, a.start || '', a.end || '');
    nodes.push({
      id,
      index: nodes.length,
      label: data.label || data.name || a.label || id,
      community: communityValue(data),
      start: range.start,
      end: range.end,
      size: Number(data.size || a.size || 1) || 1,
      rank: 0,
      x: 0,
      y: 0
    });
  }
  const edges: GxfEdge[] = [];
  const edgeRe =
    /<(?:[\w.-]+:)?edge\b([^>]*?)\/>|<(?:[\w.-]+:)?edge\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?edge>/gi;
  while ((match = edgeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const source = a.source || '';
    const target = a.target || '';
    if (!source || !target) continue;
    const data = attValues(inner, defs.edge);
    const range = spellRange(inner, a.start || '', a.end || '');
    edges.push({
      id: a.id || `e-${edges.length + 1}`,
      index: edges.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: data.label || data.name || a.label || '',
      weight: Number(data.weight || data.value || a.weight || 1) || 1,
      start: range.start,
      end: range.end
    });
  }
  if (!nodes.length) throw new Error('GEXF contains no nodes');
  const inferred = nodes.some((n) => !n.community);
  return finishDataset(name, sourceKind, directed, mode, nodes, edges, [], inferred);
}

function parseJson(text: string, fileName: string): GxfDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid GEXF JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('GEXF JSON must be an object');
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!nodeRaw.length) throw new Error('GEXF JSON is missing nodes');
  const nodes: GxfNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      label: asString(rec.label || rec.name, asString(rec.id, `n-${i + 1}`)),
      community: asString(rec.community || rec.group || rec.cluster),
      start: asString(rec.start),
      end: asString(rec.end),
      size: Number(rec.size ?? 1) || 1,
      rank: Number(rec.rank) || 0,
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const edges: GxfEdge[] = edgeRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `e-${i + 1}`),
        index: i,
        source: asString(rec.source || rec.from),
        target: asString(rec.target || rec.to),
        sourceName: '',
        targetName: '',
        label: asString(rec.label),
        weight: Number(rec.weight ?? rec.value ?? 1) || 1,
        start: asString(rec.start),
        end: asString(rec.end)
      };
    })
    .filter((e) => e.source && e.target);
  const directed = Boolean(obj.directed);
  const mode: 'static' | 'dynamic' =
    String(obj.mode || '').toLowerCase() === 'dynamic' || nodes.some((n) => n.start || n.end) ? 'dynamic' : 'static';
  const inferred = nodes.some((n) => !n.community);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'GEXF JSON'),
    'json',
    directed,
    mode,
    nodes,
    edges,
    [],
    inferred
  );
}

export function parseGexfText(text: string, fileName = ''): GxfDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('GEXF file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: GxfSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xml' : 'gexf';
  if (looksLikeJson(extracted.source)) {
    const parsed = parseJson(extracted.source, fileName);
    parsed.sourceKind = sourceKind;
    return parsed;
  }
  if (looksLikeGexf(extracted.source) || ext === 'gexf' || ext === 'xml') {
    return parseGexfXml(extracted.source, fileName, sourceKind === 'markdown' ? 'markdown' : ext === 'xml' ? 'xml' : 'gexf');
  }
  throw new Error('Not a GEXF network');
}

export function parseGexfBytes(bytes: Uint8Array, fileName = ''): GxfDataset {
  if (!bytes.length) throw new Error('GEXF file is empty');
  return parseGexfText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterGxfNodes(nodes: GxfNode[], query: string, community = '', time: number | null = null): GxfNode[] {
  let list = community ? nodes.filter((n) => n.community === community) : nodes;
  if (time != null) list = list.filter((n) => isGxfActive(n.start, n.end, time));
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('comm:') || token.startsWith('community:')) return n.community.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('node:') || token.startsWith('label:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return n.label.toLowerCase().includes(needle) || n.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('t:') || token.startsWith('time:')) {
        const t = Number(token.slice(token.indexOf(':') + 1));
        return Number.isFinite(t) && isGxfActive(n.start, n.end, t);
      }
      return `${n.id} ${n.label} ${n.community} ${n.start} ${n.end}`.toLowerCase().includes(token);
    })
  );
}

export function filterGxfEdges(edges: GxfEdge[], query: string, time: number | null = null): GxfEdge[] {
  let list = time != null ? edges.filter((e) => isGxfActive(e.start, e.end, time)) : edges;
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('label:') || token.startsWith('rel:')) return e.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('t:') || token.startsWith('time:')) {
        const t = Number(token.slice(token.indexOf(':') + 1));
        return Number.isFinite(t) && isGxfActive(e.start, e.end, t);
      }
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label} ${e.weight} ${e.start} ${e.end}`.toLowerCase().includes(token);
    })
  );
}
