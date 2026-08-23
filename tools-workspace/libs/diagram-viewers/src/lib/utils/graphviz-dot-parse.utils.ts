import type {
  GvzDataset,
  GvzEdge,
  GvzLayout,
  GvzNode,
  GvzRankdir,
  GvzShape,
  GvzSourceKind
} from '../types/graphviz-dot-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function unquote(value: string): string {
  return value.trim().replace(/^"|"$/g, '');
}

function extractDotSource(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:dot|graphviz|gv)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function stripDotComments(source: string): string {
  let out = '';
  let i = 0;
  let inQuote = false;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (inQuote) {
      out += ch;
      if (ch === '"' && source[i - 1] !== '\\') inQuote = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '#' && (i === 0 || source[i - 1] === '\n')) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function parseAttrs(block: string): Record<string, string> {
  const inner = block.replace(/^\[/, '').replace(/\]$/, '');
  const out: Record<string, string> = {};
  let cur = '';
  let key = '';
  let quote = false;
  const commit = (): void => {
    const k = (key || cur.split('=')[0] || '').trim().toLowerCase();
    const v = key ? cur.trim() : cur.split('=').slice(1).join('=').trim();
    if (k) out[k] = unquote(v);
    key = '';
    cur = '';
  };
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === '"' && inner[i - 1] !== '\\') quote = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') {
      quote = true;
      continue;
    }
    if (ch === '=') {
      key = cur;
      cur = '';
      continue;
    }
    if (ch === ',' || ch === ';') {
      commit();
      continue;
    }
    cur += ch;
  }
  if (cur.trim() || key) commit();
  return out;
}

function splitAttrPart(stmt: string): { main: string; attrs: Record<string, string> } {
  const idx = stmt.indexOf('[');
  if (idx < 0) return { main: stmt.trim(), attrs: {} };
  return { main: stmt.slice(0, idx).trim(), attrs: parseAttrs(stmt.slice(idx)) };
}

function parseIdList(main: string): string[] {
  return main
    .split(/\s*(?:->|--)\s*/)
    .map((p) => unquote(p.replace(/:[\w.]+$/, '').trim()))
    .filter(Boolean);
}

function isDirectedStmt(main: string): boolean {
  return /->/.test(main);
}

function upsertNode(nodes: GvzNode[], id: string, attrs: Record<string, string>, group: string, defaultShape: GvzShape): void {
  if (!id) return;
  const existing = nodes.find((n) => n.id === id);
  const shapeRaw = (attrs.shape || '').toLowerCase();
  const shape: GvzShape =
    shapeRaw === 'ellipse' || shapeRaw === 'circle' || shapeRaw === 'diamond' || shapeRaw === 'plaintext' || shapeRaw === 'box'
      ? shapeRaw
      : defaultShape;
  const name = attrs.label ? unquote(attrs.label) : id;
  if (existing) {
    if (attrs.label) existing.name = name;
    if (attrs.shape) existing.shape = shape;
    if (group && !existing.group) existing.group = group;
    return;
  }
  nodes.push({ id, index: nodes.length, name, shape, group, x: 0, y: 0 });
}

function parseStatements(body: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let inQuote = false;
  let bracket = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      cur += ch;
      if (ch === '"' && body[i - 1] !== '\\') inQuote = false;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      cur += ch;
      continue;
    }
    if (ch === '[') bracket++;
    if (ch === ']') bracket = Math.max(0, bracket - 1);
    if (ch === '{') {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      cur += ch;
      if (depth === 0 && bracket === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      }
      continue;
    }
    if ((ch === ';' || ch === '\n') && depth === 0 && bracket === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseDotBody(
  body: string,
  group: string,
  nodes: GvzNode[],
  edges: GvzEdge[],
  graph: { layout: GvzLayout; rankdir: GvzRankdir; defaultShape: GvzShape },
  warnings: string[]
): void {
  for (const stmt of parseStatements(body)) {
    const sub = /^(?:subgraph\s+)?("?[\w.]+"?)\s*\{([\s\S]*)\}$/i.exec(stmt);
    if (sub && (/^subgraph\b/i.test(stmt) || /^cluster_/i.test(unquote(sub[1])) || stmt.startsWith('{'))) {
      const g = unquote(sub[1]) || group;
      parseDotBody(sub[2], g, nodes, edges, graph, warnings);
      continue;
    }
    const { main, attrs } = splitAttrPart(stmt);
    if (!main) continue;
    const key = main.toLowerCase();
    if (key === 'graph' || key.startsWith('graph ')) {
      if (attrs.layout) graph.layout = normalizeLayout(attrs.layout);
      if (attrs.rankdir) graph.rankdir = normalizeRankdir(attrs.rankdir);
      continue;
    }
    if (key === 'node' || key.startsWith('node ')) {
      if (attrs.shape) graph.defaultShape = normalizeShape(attrs.shape, graph.defaultShape);
      continue;
    }
    if (key === 'edge' || key.startsWith('edge ')) continue;
    if (/^(rankdir|layout|splines|label)\s*=/.test(key)) {
      const [k, ...rest] = main.split('=');
      const v = unquote(rest.join('='));
      if (k.trim().toLowerCase() === 'rankdir') graph.rankdir = normalizeRankdir(v);
      if (k.trim().toLowerCase() === 'layout') graph.layout = normalizeLayout(v);
      continue;
    }
    if (/\s*(->|--)\s*/.test(main)) {
      const ids = parseIdList(main);
      const directed = isDirectedStmt(main);
      for (let i = 0; i < ids.length - 1; i++) {
        upsertNode(nodes, ids[i], {}, group, graph.defaultShape);
        upsertNode(nodes, ids[i + 1], {}, group, graph.defaultShape);
        edges.push({
          id: `e-${edges.length + 1}`,
          index: edges.length,
          source: ids[i],
          target: ids[i + 1],
          sourceName: ids[i],
          targetName: ids[i + 1],
          label: attrs.label || '',
          directed
        });
      }
      continue;
    }
    const nodeId = unquote(main);
    if (/^[\w.]+$/.test(nodeId) || /^".+"$/.test(main)) {
      upsertNode(nodes, nodeId, attrs, group, graph.defaultShape);
      continue;
    }
    warnings.push(`Skipped statement: ${stmt.slice(0, 80)}`);
  }
}

function normalizeLayout(value: string): GvzLayout {
  const v = value.toLowerCase();
  if (v === 'neato' || v === 'fdp' || v === 'circo' || v === 'twopi') return v;
  return 'dot';
}

function normalizeRankdir(value: string): GvzRankdir {
  const v = value.toUpperCase();
  if (v === 'LR' || v === 'RL' || v === 'BT') return v;
  return 'TB';
}

function normalizeShape(value: string, fallback: GvzShape): GvzShape {
  const v = value.toLowerCase();
  if (v === 'box' || v === 'ellipse' || v === 'circle' || v === 'diamond' || v === 'plaintext') return v;
  return fallback;
}

export function applyGvzLayout(nodes: GvzNode[], edges: GvzEdge[], layout: GvzLayout, rankdir: GvzRankdir): void {
  if (!nodes.length) return;
  if (layout === 'circo') {
    const cx = 220;
    const cy = 120;
    const radius = 80 + Math.min(80, nodes.length * 8);
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + Math.cos(a) * radius;
      n.y = cy + Math.sin(a) * radius * 0.65;
    });
    return;
  }
  if (layout === 'neato' || layout === 'fdp') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, i) => {
      n.x = 60 + (i % cols) * 140 + ((i * 17) % 23);
      n.y = 50 + Math.floor(i / cols) * 90 + ((i * 11) % 19);
    });
    return;
  }
  if (layout === 'twopi') {
    const incoming = new Set(edges.map((e) => e.target));
    const root = nodes.find((n) => !incoming.has(n.id)) ?? nodes[0];
    const rank = new Map<string, number>([[root.id, 0]]);
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift() as string;
      const r = rank.get(id) ?? 0;
      for (const e of edges.filter((edge) => edge.source === id)) {
        if (!rank.has(e.target)) {
          rank.set(e.target, r + 1);
          queue.push(e.target);
        }
      }
    }
    const rings = new Map<number, GvzNode[]>();
    for (const n of nodes) {
      const r = rank.get(n.id) ?? 1;
      const list = rings.get(r) ?? [];
      list.push(n);
      rings.set(r, list);
    }
    for (const [r, list] of rings) {
      if (r === 0) {
        list[0].x = 220;
        list[0].y = 120;
        continue;
      }
      list.forEach((n, i) => {
        const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        n.x = 220 + Math.cos(a) * (70 + r * 70);
        n.y = 120 + Math.sin(a) * (40 + r * 40);
      });
    }
    return;
  }
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
  (starts.length ? starts : [nodes[0].id]).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, GvzNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  const lr = rankdir === 'LR' || rankdir === 'RL';
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      if (lr) {
        n.x = 56 + r * 150;
        n.y = 48 + i * 86;
      } else {
        n.x = 56 + i * 150;
        n.y = 48 + r * 86;
      }
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: GvzSourceKind,
  directed: boolean,
  layout: GvzLayout,
  rankdir: GvzRankdir,
  nodes: GvzNode[],
  edges: GvzEdge[],
  warnings: string[]
): GvzDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name] as const));
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  });
  nodes.forEach((n, i) => {
    n.index = i;
  });
  applyGvzLayout(nodes, edges, layout, rankdir);
  if (!nodes.length) warnings.push('DOT graph contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('DOT graph has nodes but no edges.');
  return { name, sourceKind, directed, layout, rankdir, nodes, edges, warnings };
}

function parseDotTextBody(source: string, fileName: string, sourceKind: GvzSourceKind): GvzDataset {
  const cleaned = stripDotComments(source).trim();
  const header = /^(strict\s+)?(di)?graph\s+("([^"]+)"|[\w.]+)?\s*\{([\s\S]*)\}\s*$/i.exec(cleaned);
  if (!header) throw new Error('Not a Graphviz DOT graph');
  const directed = !!header[2];
  const name = unquote(header[4] || header[3] || fileName.replace(/\.[^.]+$/, '') || 'Graph');
  const nodes: GvzNode[] = [];
  const edges: GvzEdge[] = [];
  const warnings: string[] = [];
  const graph = { layout: 'dot' as GvzLayout, rankdir: 'TB' as GvzRankdir, defaultShape: 'ellipse' as GvzShape };
  parseDotBody(header[5] || '', '', nodes, edges, graph, warnings);
  return finishDataset(name, sourceKind, directed, graph.layout, graph.rankdir, nodes, edges, warnings);
}

function parseDotJson(text: string, fileName: string): GvzDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid DOT JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('DOT JSON must be an object');
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  if (!nodeRaw.length) throw new Error('DOT JSON is missing nodes');
  const nodes: GvzNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `n-${i + 1}`)),
      shape: normalizeShape(asString(rec.shape), 'box'),
      group: asString(rec.group),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : []) as unknown[];
  const edges: GvzEdge[] = edgeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceName: '',
      targetName: '',
      label: asString(rec.label),
      directed: rec.directed === false ? false : true
    };
  }).filter((e) => e.source && e.target);
  return finishDataset(
    asString(obj.name, fileName.replace(/\.[^.]+$/, '') || 'DOT JSON'),
    'json',
    obj.directed === false ? false : true,
    normalizeLayout(asString(obj.layout, 'dot')),
    normalizeRankdir(asString(obj.rankdir, 'TB')),
    nodes,
    edges,
    []
  );
}

export function parseDotText(text: string, fileName = ''): GvzDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('DOT file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseDotJson(raw, fileName);
  const extracted = extractDotSource(raw);
  const sourceKind: GvzSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'gv' ? 'gv' : ext === 'txt' ? 'txt' : 'dot';
  if (!/^(strict\s+)?(di)?graph\b/i.test(extracted.source) && !extracted.fenced) throw new Error('Not a Graphviz DOT graph');
  return parseDotTextBody(extracted.source, fileName, sourceKind);
}

export function parseDotBytes(bytes: Uint8Array, fileName = ''): GvzDataset {
  if (!bytes.length) throw new Error('DOT file is empty');
  return parseDotText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterGvzNodes(nodes: GvzNode[], query: string): GvzNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('shape:')) return n.shape === token.slice(6);
      if (token.startsWith('node:')) return n.name.toLowerCase().includes(token.slice(5)) || n.id.toLowerCase().includes(token.slice(5));
      if (token.startsWith('group:')) return n.group.toLowerCase().includes(token.slice(6));
      return `${n.id} ${n.name} ${n.shape} ${n.group}`.toLowerCase().includes(token);
    })
  );
}

export function filterGvzEdges(edges: GvzEdge[], query: string): GvzEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('label:') || token.startsWith('edge:')) return e.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      if (token === 'directed') return e.directed;
      if (token === 'undirected') return !e.directed;
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label}`.toLowerCase().includes(token);
    })
  );
}
