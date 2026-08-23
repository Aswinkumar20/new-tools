import type {
  MmdDataset,
  MmdDirection,
  MmdEdge,
  MmdEdgeStyle,
  MmdKind,
  MmdNode,
  MmdShape,
  MmdSourceKind
} from '../types/mermaid-diagram-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function extractMermaidSource(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:mermaid)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function parseNodeToken(token: string): { id: string; name: string; shape: MmdShape } | null {
  const t = token.trim().replace(/^["']|["']$/g, '');
  if (!t) return null;
  let m = /^([A-Za-z][\w-]*)\(\[([^\]]+)\]\)$/.exec(t);
  if (m) return { id: m[1], name: m[2], shape: 'stadium' };
  m = /^([A-Za-z][\w-]*)\(\(([^)]+)\)\)$/.exec(t);
  if (m) return { id: m[1], name: m[2], shape: 'circle' };
  m = /^([A-Za-z][\w-]*)\{([^}]+)\}$/.exec(t);
  if (m) return { id: m[1], name: m[2], shape: 'diamond' };
  m = /^([A-Za-z][\w-]*)\(([^)]+)\)$/.exec(t);
  if (m) return { id: m[1], name: m[2], shape: 'round' };
  m = /^([A-Za-z][\w-]*)\[([^\]]+)\]$/.exec(t);
  if (m) return { id: m[1], name: m[2], shape: 'rect' };
  m = /^([A-Za-z][\w-]*)$/.exec(t);
  if (m) return { id: m[1], name: m[1], shape: 'rect' };
  return null;
}

function splitFlowLine(line: string): { left: string; arrow: string; label: string; right: string } | null {
  let m = /^(.+?)\s*(-\.->|==>|-->|---)\s*\|([^|]+)\|\s*(.+)$/.exec(line);
  if (m) return { left: m[1].trim(), arrow: m[2], label: m[3].trim(), right: m[4].trim() };
  m = /^(.+?)\s*--\s*([^-]+?)\s*-->\s*(.+)$/.exec(line);
  if (m) return { left: m[1].trim(), arrow: '-->', label: m[2].trim(), right: m[3].trim() };
  m = /^(.+?)\s*(-\.->|==>|-->|---)\s*(.+)$/.exec(line);
  if (m) return { left: m[1].trim(), arrow: m[2], label: '', right: m[3].trim() };
  return null;
}

function edgeStyle(arrow: string): MmdEdgeStyle {
  if (arrow === '-.->') return 'dotted';
  if (arrow === '==>') return 'thick';
  return 'solid';
}

function upsertNode(nodes: MmdNode[], parsed: { id: string; name: string; shape: MmdShape }, group = ''): void {
  const existing = nodes.find((n) => n.id === parsed.id);
  if (existing) {
    if (parsed.name && parsed.name !== parsed.id) existing.name = parsed.name;
    if (parsed.shape !== 'rect') existing.shape = parsed.shape;
    if (group && !existing.group) existing.group = group;
    return;
  }
  nodes.push({
    id: parsed.id,
    index: nodes.length,
    name: parsed.name || parsed.id,
    shape: parsed.shape,
    group,
    x: 0,
    y: 0
  });
}

function layoutFlowchart(nodes: MmdNode[], edges: MmdEdge[], direction: MmdDirection): void {
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
  const buckets = new Map<number, MmdNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  const lr = direction === 'LR' || direction === 'RL';
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      if (lr) {
        n.x = 60 + r * 160;
        n.y = 50 + i * 90;
      } else {
        n.x = 60 + i * 160;
        n.y = 50 + r * 90;
      }
    });
  }
}

function layoutSequence(nodes: MmdNode[], edges: MmdEdge[]): void {
  nodes.forEach((n, i) => {
    n.x = 70 + i * 150;
    n.y = 36;
  });
  void edges;
}

function finishDataset(
  name: string,
  sourceKind: MmdSourceKind,
  kind: MmdKind,
  direction: MmdDirection,
  nodes: MmdNode[],
  edges: MmdEdge[],
  warnings: string[]
): MmdDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name] as const));
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
  });
  nodes.forEach((n, i) => {
    n.index = i;
  });
  if (kind === 'sequence') layoutSequence(nodes, edges);
  else layoutFlowchart(nodes, edges, direction);
  if (!nodes.length) warnings.push('Mermaid diagram contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('Mermaid diagram has nodes but no edges.');
  return { name, sourceKind, kind, direction, nodes, edges, warnings };
}

function parseFlowchart(source: string, fileName: string, sourceKind: MmdSourceKind, warnings: string[]): MmdDataset {
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  const header = /^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)?/i.exec(lines[0] || '');
  if (!header) throw new Error('Not a Mermaid flowchart');
  let direction: MmdDirection = 'TD';
  const dir = (header[1] || 'TD').toUpperCase();
  if (dir === 'LR' || dir === 'RL' || dir === 'BT') direction = dir;
  else direction = 'TD';
  const nodes: MmdNode[] = [];
  const edges: MmdEdge[] = [];
  let group = '';
  for (let i = header ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^subgraph\b/i.test(line)) {
      group = line.replace(/^subgraph\b/i, '').trim().replace(/^["']|["']$/g, '') || `g-${i}`;
      warnings.push('Subgraph grouping is preview-only.');
      continue;
    }
    if (/^end$/i.test(line)) {
      group = '';
      continue;
    }
    const split = splitFlowLine(line);
    if (split) {
      const left = parseNodeToken(split.left);
      const right = parseNodeToken(split.right);
      if (!left || !right) {
        warnings.push(`Skipped unrecognized flow: ${line}`);
        continue;
      }
      upsertNode(nodes, left, group);
      upsertNode(nodes, right, group);
      edges.push({
        id: `e-${edges.length + 1}`,
        index: edges.length,
        source: left.id,
        target: right.id,
        sourceName: left.name,
        targetName: right.name,
        label: split.label,
        style: edgeStyle(split.arrow)
      });
      continue;
    }
    const node = parseNodeToken(line);
    if (node) upsertNode(nodes, node, group);
    else warnings.push(`Skipped line: ${line}`);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Mermaid flowchart';
  return finishDataset(name.replace(/^sample-/, '').replace(/-/g, ' ') || 'Mermaid flowchart', sourceKind, 'flowchart', direction, nodes, edges, warnings);
}

function parseSequence(source: string, fileName: string, sourceKind: MmdSourceKind, warnings: string[]): MmdDataset {
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  if (!/^sequenceDiagram\b/i.test(lines[0] || '')) throw new Error('Not a Mermaid sequence diagram');
  const nodes: MmdNode[] = [];
  const edges: MmdEdge[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const participant = /^(?:participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+as\s+(.+))?$/i.exec(line);
    if (participant) {
      upsertNode(nodes, { id: participant[1], name: (participant[2] || participant[1]).trim(), shape: 'participant' });
      continue;
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|-->|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (msg) {
      upsertNode(nodes, { id: msg[1], name: msg[1], shape: 'participant' });
      upsertNode(nodes, { id: msg[3], name: msg[3], shape: 'participant' });
      edges.push({
        id: `m-${edges.length + 1}`,
        index: edges.length,
        source: msg[1],
        target: msg[3],
        sourceName: msg[1],
        targetName: msg[3],
        label: msg[4].trim(),
        style: msg[2].includes('--') ? 'return' : 'message'
      });
      continue;
    }
    if (/^(note|activate|deactivate|loop|alt|opt|par|else|end|rect)\b/i.test(line)) {
      warnings.push(`Sequence keyword "${line.split(/\s+/)[0]}" is preview-only.`);
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Mermaid sequence';
  return finishDataset(name.replace(/^sample-/, '').replace(/-/g, ' ') || 'Mermaid sequence', sourceKind, 'sequence', 'LR', nodes, edges, warnings);
}

function parseMermaidJson(text: string, fileName: string): MmdDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid Mermaid JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Mermaid JSON must be an object');
  const kind: MmdKind = asString(obj.kind || obj.type).toLowerCase() === 'sequence' ? 'sequence' : 'flowchart';
  const dirRaw = asString(obj.direction, kind === 'sequence' ? 'LR' : 'TD').toUpperCase();
  const direction: MmdDirection = dirRaw === 'LR' || dirRaw === 'RL' || dirRaw === 'BT' ? dirRaw : 'TD';
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : Array.isArray(obj.participants) ? obj.participants : []) as unknown[];
  if (!nodeRaw.length) throw new Error('Mermaid JSON is missing nodes');
  const nodes: MmdNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const shapeRaw = asString(rec.shape).toLowerCase();
    const shape: MmdShape =
      shapeRaw === 'round' || shapeRaw === 'diamond' || shapeRaw === 'stadium' || shapeRaw === 'circle' || shapeRaw === 'participant'
        ? shapeRaw
        : kind === 'sequence'
          ? 'participant'
          : 'rect';
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `n-${i + 1}`)),
      shape,
      group: asString(rec.group),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.messages) ? obj.messages : []) as unknown[];
  const edges: MmdEdge[] = edgeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const styleRaw = asString(rec.style).toLowerCase();
    const style: MmdEdgeStyle =
      styleRaw === 'dotted' || styleRaw === 'thick' || styleRaw === 'message' || styleRaw === 'return' ? styleRaw : kind === 'sequence' ? 'message' : 'solid';
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      source: asString(rec.source || rec.from),
      target: asString(rec.target || rec.to),
      sourceName: '',
      targetName: '',
      label: asString(rec.label || rec.message),
      style
    };
  }).filter((e) => e.source && e.target);
  return finishDataset(asString(obj.name, fileName.replace(/\.[^.]+$/, '') || 'Mermaid JSON'), 'json', kind, direction, nodes, edges, []);
}

export function parseMermaidText(text: string, fileName = ''): MmdDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Mermaid file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseMermaidJson(raw, fileName);
  const extracted = extractMermaidSource(raw);
  const source = extracted.source;
  const sourceKind: MmdSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : ext === 'txt' ? 'txt' : 'mmd';
  if (/^sequenceDiagram\b/i.test(source)) return parseSequence(source, fileName, sourceKind, extracted.fenced ? [] : []);
  if (/^(?:flowchart|graph)\b/i.test(source)) return parseFlowchart(source, fileName, sourceKind, []);
  throw new Error('Not a Mermaid flowchart or sequence diagram');
}

export function parseMermaidBytes(bytes: Uint8Array, fileName = ''): MmdDataset {
  if (!bytes.length) throw new Error('Mermaid file is empty');
  return parseMermaidText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterMmdNodes(nodes: MmdNode[], query: string): MmdNode[] {
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

export function filterMmdEdges(edges: MmdEdge[], query: string): MmdEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('edge:') || token.startsWith('label:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return e.label.toLowerCase().includes(needle);
      }
      if (token.startsWith('from:')) return e.sourceName.toLowerCase().includes(token.slice(5)) || e.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return e.targetName.toLowerCase().includes(token.slice(3)) || e.target.toLowerCase().includes(token.slice(3));
      return `${e.source} ${e.target} ${e.sourceName} ${e.targetName} ${e.label} ${e.style}`.toLowerCase().includes(token);
    })
  );
}
