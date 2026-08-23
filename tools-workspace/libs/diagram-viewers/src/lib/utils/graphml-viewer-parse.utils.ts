import type { GmlCommunity, GmlDataset, GmlEdge, GmlNode, GmlSourceKind } from '../types/graphml-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeGraphml(text: string): boolean {
  return /<(?:[\w.-]+:)?(graphml|graph|node|edge)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:graphml|xml|json)?\s*([\s\S]*?)```/i.exec(text);
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

function parseKeys(xml: string): Map<string, { name: string; for: string }> {
  const keys = new Map<string, { name: string; for: string }>();
  for (const m of xml.matchAll(/<(?:[\w.-]+:)?key\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const id = a.id || '';
    if (!id) continue;
    keys.set(id, { name: (a['attr.name'] || a.name || id).toLowerCase(), for: (a.for || '').toLowerCase() });
  }
  return keys;
}

function dataMap(inner: string, keys: Map<string, { name: string; for: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of inner.matchAll(/<(?:[\w.-]+:)?data\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?data>/gi)) {
    const a = attrs(m[1] || '');
    const keyId = a.key || '';
    const meta = keys.get(keyId);
    const name = meta?.name || keyId || 'value';
    const yLabel = /<(?:[\w.-]+:)?NodeLabel\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?NodeLabel>/i.exec(m[2] || '');
    const eLabel = /<(?:[\w.-]+:)?EdgeLabel\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?EdgeLabel>/i.exec(m[2] || '');
    out[name] = (yLabel?.[1] || eLabel?.[1] || innerText(m[2] || '')).trim();
  }
  for (const m of inner.matchAll(/<(?:[\w.-]+:)?data\b([^>]*)\/>/gi)) {
    const a = attrs(m[1] || '');
    const keyId = a.key || '';
    const meta = keys.get(keyId);
    out[meta?.name || keyId || 'value'] = a.value || '';
  }
  return out;
}

function communityValue(data: Record<string, string>): string {
  return data.community || data.group || data.cluster || data.modularity_class || data.modularityclass || '';
}

function connectedCommunities(nodes: GmlNode[], edges: GmlEdge[]): void {
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

function buildCommunities(nodes: GmlNode[]): GmlCommunity[] {
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

function layoutNodes(nodes: GmlNode[], edges: GmlEdge[]): void {
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
  const buckets = new Map<number, GmlNode[]>();
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

function layoutByCommunity(nodes: GmlNode[], communities: GmlCommunity[]): void {
  const index = new Map(communities.map((c, i) => [c.name, i] as const));
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const col = index.get(n.community) ?? 0;
    const row = counts.get(n.community) ?? 0;
    counts.set(n.community, row + 1);
    n.x = 56 + col * 170;
    n.y = 48 + row * 80;
  }
}

function finishDataset(
  name: string,
  sourceKind: GmlSourceKind,
  directed: boolean,
  nodes: GmlNode[],
  edges: GmlEdge[],
  warnings: string[],
  inferredCommunities: boolean
): GmlDataset {
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
  if (!nodes.length) warnings.push('GraphML contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('GraphML has nodes but no edges.');
  if (inferredCommunities) warnings.push('Communities were inferred from connected components.');
  return { name, sourceKind, directed, nodes, edges, communities, warnings };
}

function parseGraphmlXml(xml: string, fileName: string, sourceKind: GmlSourceKind): GmlDataset {
  const keys = parseKeys(xml);
  const graphTag = /<(?:[\w.-]+:)?graph\b([^>]*)>/i.exec(xml);
  const gAttrs = attrs(graphTag?.[1] || '');
  const directed = (gAttrs.edgedefault || '').toLowerCase() === 'directed';
  const name = gAttrs.id || fileName.replace(/\.[^.]+$/, '') || 'GraphML';
  const nodes: GmlNode[] = [];
  const nodeRe =
    /<(?:[\w.-]+:)?node\b([^>]*?)\/>|<(?:[\w.-]+:)?node\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?node>/gi;
  let match: RegExpExecArray | null;
  while ((match = nodeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const id = a.id || `n-${nodes.length + 1}`;
    const data = dataMap(inner, keys);
    const yLabel = /<(?:[\w.-]+:)?NodeLabel\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?NodeLabel>/i.exec(inner);
    nodes.push({
      id,
      index: nodes.length,
      label: data.label || data.name || yLabel?.[1]?.trim() || a.label || id,
      community: communityValue(data),
      rank: 0,
      x: 0,
      y: 0
    });
  }
  const edges: GmlEdge[] = [];
  const edgeRe =
    /<(?:[\w.-]+:)?edge\b([^>]*?)\/>|<(?:[\w.-]+:)?edge\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?edge>/gi;
  while ((match = edgeRe.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const inner = match[3] || '';
    const source = a.source || '';
    const target = a.target || '';
    if (!source || !target) continue;
    const data = dataMap(inner, keys);
    edges.push({
      id: a.id || `e-${edges.length + 1}`,
      index: edges.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: data.label || data.name || a.label || '',
      weight: Number(data.weight || data.value || a.weight || 1) || 1
    });
  }
  if (!nodes.length) throw new Error('GraphML contains no nodes');
  const inferred = nodes.some((n) => !n.community);
  return finishDataset(name, sourceKind, directed, nodes, edges, [], inferred);
}

function parseJson(text: string, fileName: string): GmlDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid GraphML JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Graph JSON must be an object');
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!nodeRaw.length) throw new Error('Graph JSON is missing nodes');
  const nodes: GmlNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      label: asString(rec.label || rec.name, asString(rec.id, `n-${i + 1}`)),
      community: asString(rec.community || rec.group || rec.cluster),
      rank: Number(rec.rank) || 0,
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const edges: GmlEdge[] = edgeRaw
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
        weight: Number(rec.weight ?? rec.value ?? 1) || 1
      };
    })
    .filter((e) => e.source && e.target);
  const directed = Boolean(obj.directed);
  const inferred = nodes.some((n) => !n.community);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Graph JSON'),
    'json',
    directed,
    nodes,
    edges,
    [],
    inferred
  );
}

export function parseGraphmlText(text: string, fileName = ''): GmlDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('GraphML file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: GmlSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'xml' ? 'xml' : 'graphml';
  if (looksLikeJson(extracted.source)) {
    const parsed = parseJson(extracted.source, fileName);
    parsed.sourceKind = sourceKind;
    return parsed;
  }
  if (looksLikeGraphml(extracted.source) || ext === 'graphml' || ext === 'xml') {
    return parseGraphmlXml(extracted.source, fileName, sourceKind === 'markdown' ? 'markdown' : ext === 'xml' ? 'xml' : 'graphml');
  }
  throw new Error('Not a GraphML network');
}

export function parseGraphmlBytes(bytes: Uint8Array, fileName = ''): GmlDataset {
  if (!bytes.length) throw new Error('GraphML file is empty');
  return parseGraphmlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function relayoutGml(dataset: GmlDataset, mode: 'rank' | 'community'): GmlDataset {
  const nodes = dataset.nodes.map((n) => ({ ...n }));
  const edges = dataset.edges.map((e) => ({ ...e }));
  const communities = dataset.communities.map((c) => ({ ...c, nodeIds: [...c.nodeIds] }));
  if (mode === 'community') layoutByCommunity(nodes, communities);
  else layoutNodes(nodes, edges);
  return { ...dataset, nodes, edges, communities };
}

export function filterGmlNodes(nodes: GmlNode[], query: string, community = ''): GmlNode[] {
  let list = community ? nodes.filter((n) => n.community === community) : nodes;
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
      if (token.startsWith('rank:')) return String(n.rank) === token.slice(5);
      return `${n.id} ${n.label} ${n.community} ${n.rank}`.toLowerCase().includes(token);
    })
  );
}

export function filterGmlEdges(edges: GmlEdge[], query: string): GmlEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('label:') || token.startsWith('rel:')) return e.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label} ${e.weight}`.toLowerCase().includes(token);
    })
  );
}
