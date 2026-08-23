import type { TfDataset, TfEdge, TfResource, TfSourceKind } from '../types/terraform-graph-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:terraform|resources|resource|graph)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:terraform|tf|hcl|dot|graphviz|gv)?\s*([\s\S]*?)```/i.exec(text);
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

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function unquote(value: string): string {
  return value.trim().replace(/^\\?"|^'|\\?"$|'$/g, '').replace(/\\"/g, '"');
}

function cleanTfId(raw: string): string {
  return unquote(raw)
    .replace(/^\[root\]\s*/i, '')
    .replace(/\s*\(expand\)\s*$/i, '')
    .trim();
}

function isTfResourceId(id: string): boolean {
  if (!id || id.length < 2 || /\s|->/.test(id)) return false;
  if (/^(?:graph|node|edge|subgraph|digraph|compound|newrank|rankdir|true|false)$/i.test(id)) return false;
  return /[A-Za-z0-9]/.test(id);
}

const TF_NODE_ID = String.raw`(?:"((?:\\.|[^"\n])+)"|([A-Za-z_][\w.\-]*(?:\[[^\]]+\])?))`;

function splitResource(id: string): { type: string; name: string; provider: string } {
  const providerMatch = /^provider\[["'](.+)["']\]$/.exec(id);
  if (providerMatch) return { type: 'provider', name: providerMatch[1], provider: providerMatch[1] };
  const parts = id.split('.').filter(Boolean);
  if (id.startsWith('module.') && parts.length >= 4) {
    const type = parts[parts.length - 2];
    const name = parts[parts.length - 1];
    return { type, name, provider: type.split('_')[0] || 'module' };
  }
  if (parts.length >= 2) {
    const type = parts[0];
    const name = parts.slice(1).join('.');
    return { type, name, provider: type.split('_')[0] || '' };
  }
  return { type: 'resource', name: id, provider: '' };
}

function upsertResource(resources: TfResource[], next: { id: string; name?: string; type?: string; provider?: string }): TfResource {
  const existing = resources.find((r) => r.id === next.id);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.type && next.type !== 'resource') existing.type = next.type;
    if (next.provider) existing.provider = next.provider;
    return existing;
  }
  const split = splitResource(next.id);
  const created: TfResource = {
    id: next.id,
    index: resources.length,
    name: next.name || split.name || next.id,
    type: next.type || split.type,
    provider: next.provider || split.provider,
    x: 0,
    y: 0
  };
  resources.push(created);
  return created;
}

function layoutResources(resources: TfResource[], edges: TfEdge[]): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const r of resources) {
    incoming.set(r.id, []);
    outgoing.set(r.id, []);
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target);
    incoming.get(e.target)?.push(e.source);
  }
  const rank = new Map<string, number>();
  const starts = resources.filter((r) => !(incoming.get(r.id)?.length)).map((r) => r.id);
  (starts.length ? starts : resources.slice(0, 1).map((r) => r.id)).forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, TfResource[]>();
  for (const res of resources) {
    const r = rank.get(res.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(res);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((m, i) => {
      m.x = 48 + r * 210;
      m.y = 40 + i * 120;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: TfSourceKind,
  title: string,
  resources: TfResource[],
  edges: TfEdge[],
  warnings: string[]
): TfDataset {
  const nameById = new Map(resources.map((r) => [r.id, r.name] as const));
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  });
  resources.forEach((r, i) => {
    r.index = i;
  });
  layoutResources(resources, edges);
  if (!resources.length) warnings.push('Terraform graph contains no resources.');
  if (!edges.length && resources.length) warnings.push('Terraform graph has resources but no edges.');
  return { name, sourceKind, title: title || name, resources, edges, warnings };
}

function parseDotGraph(source: string, fileName: string, sourceKind: TfSourceKind): TfDataset {
  const warnings: string[] = [];
  const cleaned = stripComments(source);
  const resources: TfResource[] = [];
  const edges: TfEdge[] = [];
  const nodeDecl = new RegExp(`${TF_NODE_ID}\\s*\\[([^\\]]*)\\]`, 'g');
  let match: RegExpExecArray | null;
  while ((match = nodeDecl.exec(cleaned))) {
    const id = cleanTfId(match[1] || match[2] || '');
    if (!isTfResourceId(id)) continue;
    const labelMatch = /label\s*=\s*(?:"((?:\\.|[^"\n])*)"|([^\s,\]]+))/i.exec(match[3] || '');
    const label = cleanTfId(labelMatch?.[1] || labelMatch?.[2] || id);
    upsertResource(resources, { id, name: isTfResourceId(label) ? label : id });
  }
  const edgeRe = new RegExp(`${TF_NODE_ID}\\s*->\\s*${TF_NODE_ID}(?:\\s*\\[([^\\]]*)\\])?`, 'g');
  while ((match = edgeRe.exec(cleaned))) {
    const sourceId = cleanTfId(match[1] || match[2] || '');
    const targetId = cleanTfId(match[3] || match[4] || '');
    if (!isTfResourceId(sourceId) || !isTfResourceId(targetId)) continue;
    upsertResource(resources, { id: sourceId });
    upsertResource(resources, { id: targetId });
    const labelMatch = /label\s*=\s*(?:"((?:\\.|[^"])*)"|([^\s,\]]+))/i.exec(match[5] || '');
    const dup = edges.some((e) => e.source === sourceId && e.target === targetId);
    if (!dup) {
      edges.push({
        id: `e-${edges.length + 1}`,
        index: edges.length,
        source: sourceId,
        target: targetId,
        sourceName: '',
        targetName: '',
        label: cleanTfId(labelMatch?.[1] || labelMatch?.[2] || '')
      });
    }
  }
  if (!resources.length) throw new Error('Terraform graph contains no resources');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ');
  return finishDataset(fromFile || 'Terraform graph', sourceKind, fromFile || 'Terraform graph', resources, edges, warnings);
}

function parseXml(xml: string, fileName: string): TfDataset {
  const root = /<(?:terraform|graph)\b([^>]*)>/i.exec(xml);
  const a = attrs(root?.[1] || '');
  const name = a.name || fileName.replace(/\.[^.]+$/, '') || 'Terraform';
  const resources: TfResource[] = [];
  const edges: TfEdge[] = [];
  const resourceRe =
    /<(?:[\w.-]+:)?resource\b([^>]*?)\/>|<(?:[\w.-]+:)?resource\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?resource>/gi;
  let match: RegExpExecArray | null;
  while ((match = resourceRe.exec(xml))) {
    const ra = attrs(match[1] || match[2] || '');
    const id = ra.id || ra.name || '';
    if (!id) continue;
    upsertResource(resources, { id, name: ra.name || id, type: ra.type, provider: ra.provider });
  }
  const edgeRe =
    /<(?:[\w.-]+:)?(?:edge|dep|depends)\b([^>]*?)\/>|<(?:[\w.-]+:)?(?:edge|dep|depends)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:edge|dep|depends)>/gi;
  while ((match = edgeRe.exec(xml))) {
    const ea = attrs(match[1] || match[2] || '');
    const source = ea.source || ea.from || '';
    const target = ea.target || ea.to || '';
    if (!source || !target) continue;
    upsertResource(resources, { id: source });
    upsertResource(resources, { id: target });
    edges.push({
      id: `e-${edges.length + 1}`,
      index: edges.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: ea.label || ea.name || ''
    });
  }
  if (!resources.length) throw new Error('Terraform XML contains no resources');
  return finishDataset(name, 'xml', name, resources, edges, []);
}

function parseJson(text: string, fileName: string): TfDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Terraform graph JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Terraform graph JSON must be an object');
  const resources: TfResource[] = [];
  const resourceRaw = (Array.isArray(obj.resources) ? obj.resources : Array.isArray(obj.nodes) ? obj.nodes : []) as unknown[];
  for (const item of resourceRaw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const id = asString(rec.id || rec.address || rec.name);
    if (!id) continue;
    upsertResource(resources, {
      id,
      name: asString(rec.name || rec.label || id),
      type: asString(rec.type || rec.resource_type),
      provider: asString(rec.provider)
    });
  }
  const edges: TfEdge[] = [];
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.dependencies) ? obj.dependencies : []) as unknown[];
  for (const item of edgeRaw) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const source = asString(rec.source || rec.from);
    const target = asString(rec.target || rec.to);
    if (!source || !target) continue;
    upsertResource(resources, { id: source });
    upsertResource(resources, { id: target });
    edges.push({
      id: `e-${edges.length + 1}`,
      index: edges.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: asString(rec.label || rec.name)
    });
  }
  if (!resources.length) throw new Error('Terraform graph JSON is missing resources');
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Terraform JSON'),
    'json',
    asString(obj.title || obj.name),
    resources,
    edges,
    []
  );
}

export function parseTerraformGraphText(text: string, fileName = ''): TfDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Terraform graph file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || (ext === 'xml' && looksLikeXml(raw))) return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: TfSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : ext === 'tfgraph' ? 'tfgraph' : 'dot';
  if (
    /\b(?:di)?graph\b/i.test(extracted.source) ||
    /->/.test(extracted.source) ||
    /\b(?:aws_|google_|azurerm_|module\.)/.test(extracted.source)
  ) {
    const parsed = parseDotGraph(extracted.source, fileName, sourceKind);
    if (!parsed.resources.length) throw new Error('Terraform graph contains no resources');
    return parsed;
  }
  throw new Error('Not a Terraform graph');
}

export function parseTerraformGraphBytes(bytes: Uint8Array, fileName = ''): TfDataset {
  if (!bytes.length) throw new Error('Terraform graph file is empty');
  return parseTerraformGraphText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterTfResources(resources: TfResource[], query: string): TfResource[] {
  const q = query.trim().toLowerCase();
  if (!q) return resources;
  const tokens = q.split(/\s+/).filter(Boolean);
  return resources.filter((r) =>
    tokens.every((token) => {
      if (token.startsWith('resource:') || token.startsWith('node:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('type:')) return r.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('provider:')) return r.provider.toLowerCase().includes(token.slice(9));
      return `${r.id} ${r.name} ${r.type} ${r.provider}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfEdges(edges: TfEdge[], query: string): TfEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('rel:') || token.startsWith('label:')) return e.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label}`.toLowerCase().includes(token);
    })
  );
}
