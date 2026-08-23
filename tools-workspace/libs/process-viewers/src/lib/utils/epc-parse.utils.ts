import type { EpcDataset, EpcFlow, EpcNode, EpcSourceKind, EpcStat } from '../types/epc-diagram-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
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

export function normalizeEpcKind(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/[\s_]+/g, '');
  if (['event', 'startevent', 'endevent'].includes(v)) return 'event';
  if (['function', 'func', 'activity', 'processstep'].includes(v)) return 'function';
  if (['xor', 'exclusive', 'xorconnector'].includes(v)) return 'xor';
  if (['and', 'andconnector', 'parallel'].includes(v)) return 'and';
  if (['or', 'orconnector', 'inclusive'].includes(v)) return 'or';
  if (['organization', 'orgunit', 'role'].includes(v)) return 'organization';
  if (['information', 'data', 'document'].includes(v)) return 'information';
  if (['process', 'subprocess'].includes(v)) return 'process';
  return v || 'event';
}

function finishDataset(name: string, sourceKind: EpcSourceKind, nodes: EpcNode[], flows: EpcFlow[], warnings: string[]): EpcDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name]));
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  for (const f of flows) {
    outCount.set(f.source, (outCount.get(f.source) ?? 0) + 1);
    inCount.set(f.target, (inCount.get(f.target) ?? 0) + 1);
    f.sourceName = nameById.get(f.source) || f.source;
    f.targetName = nameById.get(f.target) || f.target;
  }
  nodes.forEach((n) => {
    n.inCount = inCount.get(n.id) ?? 0;
    n.outCount = outCount.get(n.id) ?? 0;
  });
  const kindMap = new Map<string, EpcStat>();
  for (const n of nodes) {
    const rec = kindMap.get(n.kind) ?? { name: n.kind, count: 0 };
    rec.count += 1;
    kindMap.set(n.kind, rec);
  }
  if (!nodes.length) warnings.push('EPC diagram contains no events or functions.');
  if (!flows.length && nodes.length) warnings.push('EPC has nodes but no control-flow arcs.');
  return {
    name,
    sourceKind,
    nodes,
    events: nodes.filter((n) => n.kind === 'event'),
    functions: nodes.filter((n) => n.kind === 'function'),
    connectors: nodes.filter((n) => ['xor', 'and', 'or'].includes(n.kind)),
    flows,
    kinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function parseEpcXml(xml: string): EpcDataset {
  if (
    !/<(?:[\w.-]+:)?(epml|epc|EventDrivenProcessChain)\b/i.test(xml) &&
    !/<(?:[\w.-]+:)?(event|function)\b/i.test(xml)
  ) {
    throw new Error('Not an EPC / EPML document');
  }
  const epcMatch = /<(?:[\w.-]+:)?epc\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?epc>/i.exec(xml);
  const chainMatch = /<(?:[\w.-]+:)?EventDrivenProcessChain\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?EventDrivenProcessChain>/i.exec(xml);
  const block = epcMatch?.[2] || chainMatch?.[2] || xml;
  const head = epcMatch?.[1] || chainMatch?.[1] || /<(?:[\w.-]+:)?epml\b([^>]*)>/i.exec(xml)?.[1] || '';
  const headAttrs = attrs(head);
  const name = headAttrs.name || innerText(xml, 'name') || 'EPC diagram';
  const nodes: EpcNode[] = [];
  const kindTags = 'event|function|xor|and|or|organization|orgUnit|information|process';
  const nodeRe = new RegExp(`<(?:[\\w.-]+:)?(${kindTags})\\b([^>]*)>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?\\1>|<(?:[\\w.-]+:)?(${kindTags})\\b([^>]*)\\/>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = nodeRe.exec(block))) {
    const kind = normalizeEpcKind(match[1] || match[4] || 'event');
    const a = attrs(match[2] || match[5] || '');
    const inner = match[3] || '';
    const id = a.id || a.epcId || `${kind}-${nodes.length + 1}`;
    const n = a.name || innerText(inner, 'name') || id;
    const pos = position(inner);
    nodes.push({
      id,
      index: nodes.length,
      name: n,
      kind,
      x: pos.x,
      y: pos.y,
      inCount: 0,
      outCount: 0
    });
  }
  const flows: EpcFlow[] = [];
  const arcRe =
    /<(?:[\w.-]+:)?(arc|flow|controlFlow)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?\1>|<(?:[\w.-]+:)?(arc|flow|controlFlow)\b([^>]*)\/>/gi;
  while ((match = arcRe.exec(block))) {
    const a = attrs(match[2] || match[5] || '');
    const inner = match[3] || '';
    const source = a.from || a.source || a.sourceRef || innerText(inner, 'source') || '';
    const target = a.to || a.target || a.targetRef || innerText(inner, 'target') || '';
    if (!source || !target) continue;
    flows.push({
      id: a.id || `a-${flows.length + 1}`,
      index: flows.length,
      source,
      target,
      sourceName: source,
      targetName: target,
      label: a.name || a.label || innerText(inner, 'name') || ''
    });
  }
  if (!nodes.length) throw new Error('EPC document contains no events or functions');
  const warnings: string[] = [];
  if (!nodes.some((n) => n.kind === 'event')) warnings.push('EPC has no events.');
  return finishDataset(name, 'epc', nodes, flows, warnings);
}

function parseEpcJson(data: Record<string, unknown>): EpcDataset {
  const nodesRaw = Array.isArray(data.nodes) ? data.nodes : Array.isArray(data.elements) ? data.elements : null;
  if (!nodesRaw) throw new Error('EPC JSON is missing nodes');
  const nodes: EpcNode[] = nodesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name, `Node ${i + 1}`),
      kind: normalizeEpcKind(asString(rec.kind ?? rec.type, 'event')),
      x: asNumber(rec.x),
      y: asNumber(rec.y),
      inCount: 0,
      outCount: 0
    };
  });
  const flowsRaw = Array.isArray(data.flows) ? data.flows : Array.isArray(data.arcs) ? data.arcs : [];
  const flows: EpcFlow[] = flowsRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `a-${i + 1}`),
      index: i,
      source: asString(rec.source ?? rec.from),
      target: asString(rec.target ?? rec.to),
      sourceName: asString(rec.sourceName ?? rec.source ?? rec.from),
      targetName: asString(rec.targetName ?? rec.target ?? rec.to),
      label: asString(rec.label ?? rec.name)
    };
  });
  return finishDataset(asString(data.name, 'EPC snapshot'), 'json', nodes, flows, []);
}

function parseEpcCsv(text: string): EpcDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('EPC CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const kindI = idx('kind') >= 0 ? idx('kind') : idx('type');
  const nameI = idx('name');
  if (kindI < 0 || nameI < 0) throw new Error('EPC CSV needs kind and name columns');
  const idI = idx('id');
  const fromI = idx('from') >= 0 ? idx('from') : idx('source');
  const toI = idx('to') >= 0 ? idx('to') : idx('target');
  const nodes: EpcNode[] = [];
  const flows: EpcFlow[] = [];
  rows.slice(1).forEach((row) => {
    const kind = normalizeEpcKind(row[kindI] || 'event');
    const name = row[nameI] || `Node ${nodes.length + 1}`;
    const id = (idI >= 0 && row[idI]) || `${kind}-${nodes.length + 1}`;
    nodes.push({ id, index: nodes.length, name, kind, x: 0, y: 0, inCount: 0, outCount: 0 });
    const from = fromI >= 0 ? row[fromI] : '';
    const to = toI >= 0 ? row[toI] : '';
    if (from) {
      flows.push({
        id: `a-${flows.length + 1}`,
        index: flows.length,
        source: from,
        target: id,
        sourceName: from,
        targetName: name,
        label: ''
      });
    }
    if (to) {
      flows.push({
        id: `a-${flows.length + 1}`,
        index: flows.length,
        source: id,
        target: to,
        sourceName: name,
        targetName: to,
        label: ''
      });
    }
  });
  return finishDataset('EPC CSV', 'csv', nodes, flows, []);
}

export function parseEpcText(text: string, fileName = ''): EpcDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('EPC file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid EPC JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('EPC JSON must be an object');
    return parseEpcJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /kind|type/i.test(trimmed.split('\n')[0] || '') && /name/i.test(trimmed.split('\n')[0] || ''))) {
    return parseEpcCsv(trimmed);
  }
  if (ext === 'epc' || ext === 'xml' || /^</.test(trimmed)) return parseEpcXml(trimmed);
  throw new Error('No EPC diagram found — use .epc, XML, JSON, or CSV');
}

export function parseEpcBytes(bytes: Uint8Array, fileName = ''): EpcDataset {
  if (!bytes.length) throw new Error('EPC file is empty');
  return parseEpcText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterEpcNodes(nodes: EpcNode[], query: string): EpcNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (['event', 'function', 'xor', 'and', 'or', 'organization', 'information', 'process'].includes(token)) {
        return n.kind === token;
      }
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('node:')) return n.name.toLowerCase().includes(token.slice(5)) || n.id.toLowerCase().includes(token.slice(5));
      return `${n.id} ${n.name} ${n.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterEpcFlows(flows: EpcFlow[], query: string): EpcFlow[] {
  const q = query.trim().toLowerCase();
  if (!q) return flows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return flows.filter((f) =>
    tokens.every((token) => `${f.sourceName} ${f.targetName} ${f.label} ${f.source} ${f.target}`.toLowerCase().includes(token))
  );
}
