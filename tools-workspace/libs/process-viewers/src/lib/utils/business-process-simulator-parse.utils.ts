import type {
  BpsimDataset,
  BpsimEdge,
  BpsimEngine,
  BpsimGatewayType,
  BpsimNode,
  BpsimNodeKind,
  BpsimScenario,
  BpsimSourceKind
} from '../types/business-process-simulator.types';
import { parsePnmlText } from './pnml-parse.utils';

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

function xmlName(block: string, fallback: string): string {
  return innerText(block, 'name') || fallback;
}

function tagBlocks(xml: string, localName: string): Array<{ attrs: Record<string, string>; inner: string }> {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b([^>]*)>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>|<(?:[\\w.-]+:)?${localName}\\b([^>]*)/>`,
    'gi'
  );
  const out: Array<{ attrs: Record<string, string>; inner: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    out.push({ attrs: attrs(match[1] || match[3] || ''), inner: match[2] || '' });
  }
  return out;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeCsv(text: string): boolean {
  const first = text.trim().split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
  return /(^|,)type(,|$)/.test(first) && /(^|,)(id|source)(,|$)/.test(first);
}

function looksLikePnml(text: string): boolean {
  return /<(?:[\w.-]+:)?pnml\b/i.test(text) || /<(?:[\w.-]+:)?initialMarking\b/i.test(text);
}

function looksLikeBpmn(text: string): boolean {
  return (
    /<(?:[\w.-]+:)?definitions\b/i.test(text) ||
    /<(?:[\w.-]+:)?sequenceFlow\b/i.test(text) ||
    /bpmn/i.test(text) ||
    /<(?:[\w.-]+:)?startEvent\b/i.test(text)
  );
}

function kindFromGateway(local: string): BpsimGatewayType {
  if (/parallel/i.test(local)) return 'and';
  if (/inclusive|complex/i.test(local)) return 'or';
  return 'xor';
}

function nodeKindFromLocal(local: string): { kind: BpsimNodeKind; gatewayType: BpsimGatewayType | '' } {
  if (/startEvent/i.test(local)) return { kind: 'start', gatewayType: '' };
  if (/endEvent/i.test(local)) return { kind: 'end', gatewayType: '' };
  if (/Gateway/i.test(local)) return { kind: 'gateway', gatewayType: kindFromGateway(local) };
  return { kind: 'task', gatewayType: '' };
}

function finishDataset(
  name: string,
  sourceKind: BpsimSourceKind,
  engine: BpsimEngine,
  netType: string,
  nodes: BpsimNode[],
  edges: BpsimEdge[],
  scenarios: BpsimScenario[],
  warnings: string[]
): BpsimDataset {
  const nameById = new Map(nodes.map((n) => [n.id, n.name] as const));
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  edges.forEach((e, i) => {
    e.index = i;
    e.sourceName = nameById.get(e.source) || e.source;
    e.targetName = nameById.get(e.target) || e.target;
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
  });
  nodes.forEach((n, i) => {
    n.index = i;
    n.inCount = inCount.get(n.id) ?? 0;
    n.outCount = outCount.get(n.id) ?? 0;
  });
  layoutIfNeeded(nodes, edges, engine);
  const resolvedScenarios = scenarios.length ? scenarios.map((s, i) => ({ ...s, index: i })) : autoScenarios(nodes, edges, engine);
  if (!nodes.length) warnings.push('Process contains no nodes.');
  if (!edges.length && nodes.length) warnings.push('Process has nodes but no flows.');
  const startTokens = nodes.filter((n) => n.kind === 'start' || n.kind === 'place').reduce((sum, n) => sum + n.initialTokens, 0);
  if (!startTokens && engine === 'bpmn') warnings.push('No start tokens — apply a scenario or mark a start event.');
  if (!startTokens && engine === 'petri') warnings.push('Initial marking is empty — no tokens on any place.');
  return { name, sourceKind, engine, netType, nodes, edges, scenarios: resolvedScenarios, warnings };
}

function layoutIfNeeded(nodes: BpsimNode[], edges: BpsimEdge[], engine: BpsimEngine): void {
  if (engine === 'petri' && nodes.some((n) => n.x || n.y)) return;
  if (nodes.some((n) => n.x || n.y)) return;
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
  const queue = nodes.filter((n) => n.kind === 'start' || !(incoming.get(n.id)?.length)).map((n) => n.id);
  queue.forEach((id) => rank.set(id, 0));
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
  const buckets = new Map<number, BpsimNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(n);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((n, i) => {
      n.x = 48 + r * 150;
      n.y = 48 + i * 88;
    });
  }
}

function defaultMarking(nodes: BpsimNode[], engine: BpsimEngine, multiplier = 1): Record<string, number> {
  const marking: Record<string, number> = {};
  for (const n of nodes) {
    if (engine === 'petri') {
      marking[n.id] = n.kind === 'place' ? n.initialTokens * multiplier : 0;
    } else if (n.kind === 'start') {
      marking[n.id] = Math.max(1, n.initialTokens || 1) * multiplier;
    } else {
      marking[n.id] = n.initialTokens;
    }
  }
  return marking;
}

function firstChoiceMap(nodes: BpsimNode[], edges: BpsimEdge[], pick = 0): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const n of nodes) {
    if (n.kind !== 'gateway') continue;
    const outs = edges.filter((e) => e.source === n.id && e.label);
    if (!outs.length) continue;
    const edge = outs[Math.min(pick, outs.length - 1)];
    if (edge?.label) choices[n.id] = edge.label;
  }
  return choices;
}

function autoScenarios(nodes: BpsimNode[], edges: BpsimEdge[], engine: BpsimEngine): BpsimScenario[] {
  if (engine === 'petri') {
    return [
      { id: 'initial', index: 0, name: 'Initial marking', description: 'Tokens from the net', marking: defaultMarking(nodes, engine, 1), choices: {} },
      { id: 'empty', index: 1, name: 'Empty', description: 'No tokens', marking: defaultMarking(nodes, engine, 0), choices: {} },
      { id: 'busy', index: 2, name: 'Busy', description: 'Double initial tokens', marking: defaultMarking(nodes, engine, 2), choices: {} }
    ];
  }
  return [
    { id: 'happy', index: 0, name: 'Happy path', description: 'First gateway choice', marking: defaultMarking(nodes, engine, 1), choices: firstChoiceMap(nodes, edges, 0) },
    { id: 'alternate', index: 1, name: 'Alternate path', description: 'Second gateway choice', marking: defaultMarking(nodes, engine, 1), choices: firstChoiceMap(nodes, edges, 1) },
    { id: 'rush', index: 2, name: 'Rush', description: 'Three concurrent cases', marking: defaultMarking(nodes, engine, 3), choices: firstChoiceMap(nodes, edges, 0) }
  ];
}

function parseBpmnXml(xml: string, fileName: string): BpsimDataset {
  const processMatch = /<(?:[\w.-]+:)?process\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?process>/i.exec(xml);
  const processAttrs = attrs(processMatch?.[1] ?? '');
  const block = processMatch?.[2] || xml;
  const defsName = attrs(/<(?:[\w.-]+:)?definitions\b([^>]*)/i.exec(xml)?.[1] ?? '').name;
  const name = processAttrs.name || defsName || fileName.replace(/\.[^.]+$/, '') || 'BPMN process';
  const nodes: BpsimNode[] = [];
  const seen = new Set<string>();
  const elementNames = [
    'startEvent',
    'endEvent',
    'task',
    'userTask',
    'serviceTask',
    'sendTask',
    'receiveTask',
    'scriptTask',
    'manualTask',
    'businessRuleTask',
    'callActivity',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'complexGateway',
    'eventBasedGateway'
  ];
  for (const local of elementNames) {
    for (const item of tagBlocks(block, local)) {
      const id = item.attrs.id || `${local}-${nodes.length + 1}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const { kind, gatewayType } = nodeKindFromLocal(local);
      nodes.push({
        id,
        index: nodes.length,
        name: item.attrs.name || xmlName(item.inner, id),
        kind,
        gatewayType,
        initialTokens: kind === 'start' ? 1 : 0,
        x: 0,
        y: 0,
        inCount: 0,
        outCount: 0
      });
    }
  }
  const edges: BpsimEdge[] = tagBlocks(block, 'sequenceFlow').map((item, i) => ({
    id: item.attrs.id || `f-${i + 1}`,
    index: i,
    source: item.attrs.sourceRef || '',
    target: item.attrs.targetRef || '',
    sourceName: '',
    targetName: '',
    label: item.attrs.name || xmlName(item.inner, ''),
    weight: 1
  })).filter((e) => e.source && e.target);
  if (!nodes.length) throw new Error('BPMN process contains no activities');
  return finishDataset(name, 'bpmn', 'bpmn', 'BPMN', nodes, edges, [], []);
}

function parsePnmlAsSim(text: string, fileName: string): BpsimDataset {
  const pnml = parsePnmlText(text, fileName);
  const nodes: BpsimNode[] = [
    ...pnml.places.map((p) => ({
      id: p.id,
      index: p.index,
      name: p.name,
      kind: 'place' as const,
      gatewayType: '' as const,
      initialTokens: p.tokens,
      x: p.x,
      y: p.y,
      inCount: p.inCount,
      outCount: p.outCount
    })),
    ...pnml.transitions.map((t) => ({
      id: t.id,
      index: pnml.places.length + t.index,
      name: t.name,
      kind: 'transition' as const,
      gatewayType: '' as const,
      initialTokens: 0,
      x: t.x,
      y: t.y,
      inCount: t.inCount,
      outCount: t.outCount
    }))
  ];
  const edges: BpsimEdge[] = pnml.arcs.map((a) => ({
    id: a.id,
    index: a.index,
    source: a.source,
    target: a.target,
    sourceName: a.sourceName,
    targetName: a.targetName,
    label: a.weight > 1 ? String(a.weight) : '',
    weight: a.weight
  }));
  return finishDataset(pnml.name, 'pnml', 'petri', pnml.netType || 'PNML', nodes, edges, [], [...pnml.warnings]);
}

function parseScenarioSpec(spec: string): { marking: Record<string, number>; choices: Record<string, string> } {
  const marking: Record<string, number> = {};
  const choices: Record<string, string> = {};
  for (const part of spec.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key) continue;
    if (/^-?\d+(\.\d+)?$/.test(value)) marking[key] = asNumber(value, 0);
    else choices[key] = value;
  }
  return { marking, choices };
}

function parseSimJson(text: string, fileName: string): BpsimDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid simulator JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Simulator JSON must be an object');
  const engine: BpsimEngine = asString(obj.engine).toLowerCase() === 'petri' ? 'petri' : 'bpmn';
  const nodeRaw = (Array.isArray(obj.nodes) ? obj.nodes : Array.isArray(obj.places) ? [...(obj.places as unknown[]), ...((obj.transitions as unknown[]) || [])] : null) as unknown[] | null;
  if (!nodeRaw?.length) throw new Error('Simulator JSON is missing nodes');
  const nodes: BpsimNode[] = nodeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const kindRaw = asString(rec.kind || rec.type).toLowerCase();
    let kind: BpsimNodeKind = 'task';
    if (kindRaw === 'start' || kindRaw === 'end' || kindRaw === 'task' || kindRaw === 'gateway' || kindRaw === 'place' || kindRaw === 'transition') kind = kindRaw;
    else if (engine === 'petri' && i < ((obj.places as unknown[]) || []).length) kind = 'place';
    else if (engine === 'petri') kind = 'transition';
    const gw = asString(rec.gatewayType || rec.gateway).toLowerCase();
    return {
      id: asString(rec.id, `n-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `n-${i + 1}`)),
      kind,
      gatewayType: gw === 'and' || gw === 'or' || gw === 'xor' ? gw : kind === 'gateway' ? 'xor' : '',
      initialTokens: asNumber(rec.tokens ?? rec.initialTokens, kind === 'start' ? 1 : 0),
      x: asNumber(rec.x),
      y: asNumber(rec.y),
      inCount: 0,
      outCount: 0
    };
  });
  const edgeRaw = (Array.isArray(obj.edges) ? obj.edges : Array.isArray(obj.flows) ? obj.flows : Array.isArray(obj.arcs) ? obj.arcs : []) as unknown[];
  const edges: BpsimEdge[] = edgeRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `e-${i + 1}`),
      index: i,
      source: asString(rec.source || rec.from || rec.sourceRef),
      target: asString(rec.target || rec.to || rec.targetRef),
      sourceName: '',
      targetName: '',
      label: asString(rec.label || rec.name),
      weight: Math.max(1, asNumber(rec.weight, 1))
    };
  }).filter((e) => e.source && e.target);
  const scenarioRaw = (Array.isArray(obj.scenarios) ? obj.scenarios : []) as unknown[];
  const scenarios: BpsimScenario[] = scenarioRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const markingSrc = rec.marking && typeof rec.marking === 'object' ? rec.marking as Record<string, unknown> : {};
    const choiceSrc = rec.choices && typeof rec.choices === 'object' ? rec.choices as Record<string, unknown> : {};
    const marking: Record<string, number> = {};
    const choices: Record<string, string> = {};
    for (const [k, v] of Object.entries(markingSrc)) marking[k] = asNumber(v, 0);
    for (const [k, v] of Object.entries(choiceSrc)) choices[k] = asString(v);
    if (!Object.keys(marking).length && rec.spec) {
      const parsed = parseScenarioSpec(asString(rec.spec));
      Object.assign(marking, parsed.marking);
      Object.assign(choices, parsed.choices);
    }
    return {
      id: asString(rec.id, `sc-${i + 1}`),
      index: i,
      name: asString(rec.name, `Scenario ${i + 1}`),
      description: asString(rec.description),
      marking,
      choices
    };
  });
  return finishDataset(asString(obj.name, fileName.replace(/\.[^.]+$/, '') || 'Simulator JSON'), 'json', engine, asString(obj.netType, engine === 'petri' ? 'PNML JSON' : 'BPMN JSON'), nodes, edges, scenarios, []);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseSimCsv(text: string, fileName: string): BpsimDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Simulator CSV is empty');
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string): number => header.indexOf(name);
  const typeI = idx('type');
  const idI = idx('id');
  const nameI = idx('name');
  const kindI = idx('kind');
  const tokensI = idx('tokens');
  const sourceI = idx('source');
  const targetI = idx('target');
  const labelI = idx('label');
  const weightI = idx('weight');
  if (typeI < 0) throw new Error('Simulator CSV must include a type column');
  const nodes: BpsimNode[] = [];
  const edges: BpsimEdge[] = [];
  const scenarios: BpsimScenario[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const type = (cols[typeI] || '').toLowerCase();
    if (type === 'node' || type === 'place' || type === 'transition' || type === 'task') {
      const kindRaw = (cols[kindI] || type).toLowerCase();
      let kind: BpsimNodeKind = 'task';
      let gatewayType: BpsimGatewayType | '' = '';
      if (kindRaw === 'start' || kindRaw === 'end' || kindRaw === 'task' || kindRaw === 'place' || kindRaw === 'transition' || kindRaw === 'gateway') kind = kindRaw as BpsimNodeKind;
      else if (kindRaw === 'xor' || kindRaw === 'and' || kindRaw === 'or') {
        kind = 'gateway';
        gatewayType = kindRaw;
      }
      nodes.push({
        id: cols[idI] || `n-${nodes.length + 1}`,
        index: nodes.length,
        name: cols[nameI] || cols[idI] || `n-${nodes.length + 1}`,
        kind,
        gatewayType: gatewayType || (kind === 'gateway' ? 'xor' : ''),
        initialTokens: asNumber(cols[tokensI], kind === 'start' ? 1 : 0),
        x: 0,
        y: 0,
        inCount: 0,
        outCount: 0
      });
    } else if (type === 'edge' || type === 'flow' || type === 'arc') {
      edges.push({
        id: cols[idI] || `e-${edges.length + 1}`,
        index: edges.length,
        source: cols[sourceI] || '',
        target: cols[targetI] || '',
        sourceName: '',
        targetName: '',
        label: cols[labelI] || '',
        weight: Math.max(1, asNumber(cols[weightI], 1))
      });
    } else if (type === 'scenario') {
      const spec = cols[labelI] || cols[nameI] || '';
      const parsed = parseScenarioSpec(spec.includes('=') ? spec : `${cols[sourceI] || ''}=${cols[targetI] || spec}`);
      if (!Object.keys(parsed.marking).length && !Object.keys(parsed.choices).length) {
        Object.assign(parsed, parseScenarioSpec(spec));
      }
      scenarios.push({
        id: cols[idI] || `sc-${scenarios.length + 1}`,
        index: scenarios.length,
        name: cols[nameI] || `Scenario ${scenarios.length + 1}`,
        description: '',
        marking: parsed.marking,
        choices: parsed.choices
      });
    }
  }
  if (!nodes.length) throw new Error('Simulator CSV is missing nodes');
  const engine: BpsimEngine = nodes.some((n) => n.kind === 'place' || n.kind === 'transition') ? 'petri' : 'bpmn';
  return finishDataset(fileName.replace(/\.[^.]+$/, '') || 'Simulator CSV', 'csv', engine, engine === 'petri' ? 'PNML CSV' : 'BPMN CSV', nodes, edges, scenarios, []);
}

export function parseBpsimText(text: string, fileName = ''): BpsimDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Simulator file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseSimJson(raw, fileName);
  if (looksLikePnml(raw) || ext === 'pnml') return parsePnmlAsSim(raw, fileName);
  if (looksLikeBpmn(raw) || ext === 'bpmn') return parseBpmnXml(raw, fileName);
  if (looksLikeCsv(raw) || ext === 'csv') return parseSimCsv(raw, fileName);
  throw new Error('Not a BPMN, PNML, JSON, or CSV simulator document');
}

export function parseBpsimBytes(bytes: Uint8Array, fileName = ''): BpsimDataset {
  if (!bytes.length) throw new Error('Simulator file is empty');
  return parseBpsimText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function initialBpsimMarking(dataset: BpsimDataset, scenario?: BpsimScenario | null): Record<string, number> {
  const marking: Record<string, number> = {};
  for (const n of dataset.nodes) marking[n.id] = 0;
  if (scenario && Object.keys(scenario.marking).length) {
    for (const n of dataset.nodes) {
      if (scenario.marking[n.id] != null) marking[n.id] = Math.max(0, scenario.marking[n.id]);
      else if (n.kind === 'place' || n.kind === 'start') marking[n.id] = 0;
    }
    return marking;
  }
  return defaultMarking(dataset.nodes, dataset.engine, 1);
}

export function tokenTotal(marking: Record<string, number>): number {
  return Object.values(marking).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

export function enabledBpsimIds(dataset: BpsimDataset, marking: Record<string, number>): string[] {
  if (dataset.engine === 'petri') {
    return dataset.nodes
      .filter((n) => n.kind === 'transition')
      .filter((t) => {
        const inputs = dataset.edges.filter((e) => e.target === t.id);
        if (!inputs.length) return false;
        return inputs.every((e) => (marking[e.source] ?? 0) >= Math.max(1, e.weight || 1));
      })
      .map((t) => t.id);
  }
  return dataset.nodes
    .filter((n) => n.kind !== 'end' && (marking[n.id] ?? 0) >= 1 && dataset.edges.some((e) => e.source === n.id))
    .map((n) => n.id);
}

export function fireBpsimStep(
  dataset: BpsimDataset,
  marking: Record<string, number>,
  nodeId: string,
  choices: Record<string, string>
): { ok: boolean; marking: Record<string, number>; reason?: string } {
  const node = dataset.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, marking, reason: 'Unknown node' };
  if (!enabledBpsimIds(dataset, marking).includes(nodeId)) {
    return { ok: false, marking, reason: `${node.name} is not enabled` };
  }
  if (dataset.engine === 'petri') {
    const next = { ...marking };
    for (const e of dataset.edges.filter((edge) => edge.target === nodeId)) {
      next[e.source] = (next[e.source] ?? 0) - Math.max(1, e.weight || 1);
    }
    for (const e of dataset.edges.filter((edge) => edge.source === nodeId)) {
      next[e.target] = (next[e.target] ?? 0) + Math.max(1, e.weight || 1);
    }
    return { ok: true, marking: next };
  }
  const next = { ...marking, [nodeId]: (marking[nodeId] ?? 0) - 1 };
  const outs = dataset.edges.filter((e) => e.source === nodeId);
  if (!outs.length) return { ok: false, marking, reason: `${node.name} has no outgoing flow` };
  const andSplit = node.kind === 'gateway' && node.gatewayType === 'and';
  const xorSplit = node.kind === 'gateway' && (node.gatewayType === 'xor' || node.gatewayType === 'or' || !node.gatewayType);
  if (andSplit || (!xorSplit && outs.length > 1 && node.kind !== 'gateway')) {
    for (const e of outs) next[e.target] = (next[e.target] ?? 0) + Math.max(1, e.weight || 1);
  } else if (xorSplit) {
    const choice = (choices[nodeId] || '').toLowerCase();
    const picked = outs.find((e) => e.label && e.label.toLowerCase() === choice) || outs[0];
    next[picked.target] = (next[picked.target] ?? 0) + Math.max(1, picked.weight || 1);
  } else {
    next[outs[0].target] = (next[outs[0].target] ?? 0) + Math.max(1, outs[0].weight || 1);
  }
  return { ok: true, marking: next };
}

export function formatBpsimMarking(dataset: BpsimDataset, marking: Record<string, number>): string {
  const relevant = dataset.engine === 'petri' ? dataset.nodes.filter((n) => n.kind === 'place') : dataset.nodes.filter((n) => n.kind !== 'transition');
  return relevant.map((n) => `${n.name}=${marking[n.id] ?? 0}`).join(';');
}

export function filterBpsimNodes(
  nodes: BpsimNode[],
  query: string,
  marking: Record<string, number>,
  enabledIds: ReadonlyArray<string>
): BpsimNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const enabled = new Set(enabledIds);
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      const current = marking[n.id] ?? n.initialTokens;
      if (token === 'enabled') return enabled.has(n.id);
      if (token === 'disabled') return !enabled.has(n.id);
      if (token === 'marked' || token === 'tokens') return current > 0;
      if (token === 'empty') return current === 0;
      if (token.startsWith('kind:')) return n.kind === token.slice(5);
      if (token.startsWith('node:')) return n.name.toLowerCase().includes(token.slice(5)) || n.id.toLowerCase().includes(token.slice(5));
      return `${n.id} ${n.name} ${n.kind} ${current}`.toLowerCase().includes(token);
    })
  );
}

export function filterBpsimScenarios(scenarios: BpsimScenario[], query: string): BpsimScenario[] {
  const q = query.trim().toLowerCase();
  if (!q) return scenarios;
  const tokens = q.split(/\s+/).filter(Boolean);
  return scenarios.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('scenario:')) return s.name.toLowerCase().includes(token.slice(9)) || s.id.toLowerCase().includes(token.slice(9));
      return `${s.id} ${s.name} ${s.description}`.toLowerCase().includes(token);
    })
  );
}
