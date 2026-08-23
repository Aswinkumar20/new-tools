import type {
  WorkflowDataset,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSourceKind,
  WorkflowStat
} from '../types/workflow-diagram-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function innerText(block: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i');
  const match = re.exec(block);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : '';
}

function position(block: string): { x: number; y: number } {
  const pos = /<(?:[\w.-]+:)?position\b([^>]*)\/?>/i.exec(block)?.[1] ?? '';
  const a = attrs(pos);
  return { x: asNumber(a.x), y: asNumber(a.y) };
}

export function normalizeWorkflowKind(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (['start', 'startevent', 'begin'].includes(v)) return 'start';
  if (['end', 'endevent', 'stop', 'finish'].includes(v)) return 'end';
  if (['task', 'activity', 'step', 'action'].includes(v)) return 'task';
  if (['decision', 'gateway', 'xor', 'exclusive', 'choice'].includes(v)) return 'decision';
  if (['fork', 'split', 'and', 'parallel'].includes(v)) return 'fork';
  if (['join', 'merge', 'andjoin'].includes(v)) return 'join';
  if (['event', 'timer', 'message'].includes(v)) return 'event';
  if (['subprocess', 'subflow', 'process'].includes(v)) return 'subprocess';
  return v || 'task';
}

function finishDataset(
  name: string,
  sourceKind: WorkflowSourceKind,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  warnings: string[]
): WorkflowDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name]));
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  for (const e of edges) {
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  }
  nodes.forEach((n) => {
    n.inCount = inCount.get(n.id) ?? 0;
    n.outCount = outCount.get(n.id) ?? 0;
  });
  const kindMap = new Map<string, WorkflowStat>();
  for (const n of nodes) {
    const rec = kindMap.get(n.kind) ?? { name: n.kind, count: 0 };
    rec.count += 1;
    kindMap.set(n.kind, rec);
  }
  if (!nodes.length) warnings.push('Workflow diagram contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('Workflow has nodes but no edges.');
  return {
    name,
    sourceKind,
    nodes,
    edges,
    kinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function parseWorkflowXml(xml: string): WorkflowDataset {
  if (
    !/<(?:[\w.-]+:)?(workflow|graphml|graph|process|flow)\b/i.test(xml) &&
    !/<(?:[\w.-]+:)?(node|activity|task|edge|transition)\b/i.test(xml)
  ) {
    throw new Error('Not a workflow diagram document');
  }
  const root =
    /<(?:[\w.-]+:)?(workflow|process|graph|flow)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1>/i.exec(xml) ||
    /<(?:[\w.-]+:)?graphml\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?graphml>/i.exec(xml);
  const head = root?.[2] || root?.[1] || /<(?:[\w.-]+:)?workflow\b([^>]*)>/i.exec(xml)?.[1] || '';
  const block = root?.[3] || root?.[2] || xml;
  const ha = attrs(typeof head === 'string' ? head : '');
  const name = ha.name || innerText(xml, 'name') || 'Workflow';
  const nodes: WorkflowNode[] = [];
  const nodeRe =
    /<(?:[\w.-]+:)?(node|activity|task|step)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1>|<(?:[\w.-]+:)?(node|activity|task|step)\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = nodeRe.exec(block))) {
    const a = attrs(match[2] || match[5] || '');
    const inner = match[3] || '';
    const id = a.id || `n-${nodes.length + 1}`;
    const n = a.name || a.label || innerText(inner, 'name') || innerText(inner, 'data') || innerText(inner, 'label') || id;
    const pos = position(inner);
    nodes.push({
      id,
      index: nodes.length,
      name: n,
      kind: normalizeWorkflowKind(a.kind || a.type || a.shape || 'task'),
      x: pos.x || asNumber(a.x),
      y: pos.y || asNumber(a.y),
      inCount: 0,
      outCount: 0
    });
  }
  const edges: WorkflowEdge[] = [];
  const edgeRe =
    /<(?:[\w.-]+:)?(edge|transition|sequenceFlow|arc)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1>|<(?:[\w.-]+:)?(edge|transition|sequenceFlow|arc)\b([^>]*)\/>/gi;
  while ((match = edgeRe.exec(block))) {
    const a = attrs(match[2] || match[5] || '');
    const inner = match[3] || '';
    const source = a.source || a.from || a.sourceRef || innerText(inner, 'source') || '';
    const target = a.target || a.to || a.targetRef || innerText(inner, 'target') || '';
    if (!source || !target) continue;
    edges.push({
      id: a.id || `e-${edges.length + 1}`,
      index: edges.length,
      source,
      target,
      sourceName: source,
      targetName: target,
      label: a.label || a.name || innerText(inner, 'label') || innerText(inner, 'name') || ''
    });
  }
  if (!nodes.length) throw new Error('Workflow document contains no nodes');
  return finishDataset(name, 'xml', nodes, edges, []);
}

function parseWorkflowJson(data: Record<string, unknown>): WorkflowDataset {
  const nodesRaw = Array.isArray(data.nodes) ? data.nodes : Array.isArray(data.activities) ? data.activities : null;
  if (!nodesRaw) throw new Error('Workflow JSON is missing nodes');
  const nodes: WorkflowNode[] = nodesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name ?? rec.label, `Node ${i + 1}`),
      kind: normalizeWorkflowKind(asString(rec.kind ?? rec.type, 'task')),
      x: asNumber(rec.x),
      y: asNumber(rec.y),
      inCount: 0,
      outCount: 0
    };
  });
  const edgesRaw = Array.isArray(data.edges) ? data.edges : Array.isArray(data.flows) ? data.flows : [];
  const edges: WorkflowEdge[] = edgesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      source: asString(rec.source ?? rec.from),
      target: asString(rec.target ?? rec.to),
      sourceName: asString(rec.sourceName ?? rec.source ?? rec.from),
      targetName: asString(rec.targetName ?? rec.target ?? rec.to),
      label: asString(rec.label ?? rec.name)
    };
  });
  return finishDataset(asString(data.name, 'Workflow snapshot'), 'json', nodes, edges, []);
}

function parseWorkflowCsv(text: string): WorkflowDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Workflow CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const kindI = idx('kind') >= 0 ? idx('kind') : idx('type');
  const nameI = idx('name');
  if (kindI < 0 || nameI < 0) throw new Error('Workflow CSV needs kind and name columns');
  const idI = idx('id');
  const fromI = idx('from') >= 0 ? idx('from') : idx('source');
  const toI = idx('to') >= 0 ? idx('to') : idx('target');
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  rows.slice(1).forEach((row) => {
    const kind = normalizeWorkflowKind(row[kindI] || 'task');
    const name = row[nameI] || `Node ${nodes.length + 1}`;
    const id = (idI >= 0 && row[idI]) || `${kind}-${nodes.length + 1}`;
    nodes.push({ id, index: nodes.length, name, kind, x: 0, y: 0, inCount: 0, outCount: 0 });
    const from = fromI >= 0 ? row[fromI] : '';
    const to = toI >= 0 ? row[toI] : '';
    if (from) {
      edges.push({
        id: `e-${edges.length + 1}`,
        index: edges.length,
        source: from,
        target: id,
        sourceName: from,
        targetName: name,
        label: ''
      });
    }
    if (to) {
      edges.push({
        id: `e-${edges.length + 1}`,
        index: edges.length,
        source: id,
        target: to,
        sourceName: name,
        targetName: to,
        label: ''
      });
    }
  });
  return finishDataset('Workflow CSV', 'csv', nodes, edges, []);
}

export function parseWorkflowText(text: string, fileName = ''): WorkflowDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Workflow file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid workflow JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('Workflow JSON must be an object');
    return parseWorkflowJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /kind|type/i.test(trimmed.split('\n')[0] || '') && /name/i.test(trimmed.split('\n')[0] || ''))) {
    return parseWorkflowCsv(trimmed);
  }
  if (ext === 'xml' || ext === 'wf' || /^</.test(trimmed)) return parseWorkflowXml(trimmed);
  throw new Error('No workflow diagram found — use XML, .wf, JSON, or CSV');
}

export function parseWorkflowBytes(bytes: Uint8Array, fileName = ''): WorkflowDataset {
  if (!bytes.length) throw new Error('Workflow file is empty');
  return parseWorkflowText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterWorkflowNodes(nodes: WorkflowNode[], query: string): WorkflowNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (['start', 'end', 'task', 'decision', 'fork', 'join', 'event', 'subprocess'].includes(token)) return n.kind === token;
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('node:')) return n.name.toLowerCase().includes(token.slice(5)) || n.id.toLowerCase().includes(token.slice(5));
      return `${n.id} ${n.name} ${n.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterWorkflowEdges(edges: WorkflowEdge[], query: string): WorkflowEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => `${e.sourceName} ${e.targetName} ${e.label} ${e.source} ${e.target}`.toLowerCase().includes(token))
  );
}
