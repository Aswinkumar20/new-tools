import type {
  ProcessMiningActivity,
  ProcessMiningDataset,
  ProcessMiningDfgEdge,
  ProcessMiningSourceKind,
  ProcessMiningVariant
} from '../types/process-mining-viewer.types';
import { collapseActivityPath, parseRawEventLogText, type RawLogParse } from './event-log-core.utils';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function splitPath(raw: string): string[] {
  return raw
    .split(/>|,|\||->/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function variantName(path: string[], index: number): string {
  if (!path.length) return `Variant ${index + 1}`;
  if (path.includes('Reject') || /reject/i.test(path.join(' '))) return index === 0 ? 'Reject path' : 'Credit reject';
  if (path.includes('Invoice') && path.includes('Ship')) {
    const inv = path.indexOf('Invoice');
    const ship = path.indexOf('Ship');
    if (inv >= 0 && ship >= 0 && inv < ship) return 'Invoice before ship';
  }
  return index === 0 ? 'Happy path' : `Variant ${index + 1}`;
}

function mineFromLog(log: RawLogParse): ProcessMiningDataset {
  const warnings = [...log.warnings];
  const paths = log.traces.map((t) => collapseActivityPath(t.events));
  const variantMap = new Map<string, { path: string[]; cases: number }>();
  const dfgMap = new Map<string, { source: string; target: string; frequency: number }>();
  const activityMap = new Map<string, { frequency: number; start: number; end: number }>();

  for (const trace of log.traces) {
    const path = collapseActivityPath(trace.events);
    if (!path.length) continue;
    const key = path.join('>');
    const rec = variantMap.get(key) ?? { path, cases: 0 };
    rec.cases += 1;
    variantMap.set(key, rec);

    const start = activityMap.get(path[0]) ?? { frequency: 0, start: 0, end: 0 };
    start.start += 1;
    activityMap.set(path[0], start);
    const end = activityMap.get(path[path.length - 1]) ?? { frequency: 0, start: 0, end: 0 };
    end.end += 1;
    activityMap.set(path[path.length - 1], end);

    for (const name of path) {
      const a = activityMap.get(name) ?? { frequency: 0, start: 0, end: 0 };
      a.frequency += 1;
      activityMap.set(name, a);
    }
    for (let i = 0; i < path.length - 1; i++) {
      const dKey = `${path[i]}>${path[i + 1]}`;
      const d = dfgMap.get(dKey) ?? { source: path[i], target: path[i + 1], frequency: 0 };
      d.frequency += 1;
      dfgMap.set(dKey, d);
    }
  }

  const cases = log.traces.length;
  const events = log.traces.reduce((sum, t) => sum + t.events.length, 0);
  const variants: ProcessMiningVariant[] = [...variantMap.values()]
    .sort((a, b) => b.cases - a.cases || a.path.join('>').localeCompare(b.path.join('>')))
    .map((v, i) => ({
      id: `v-${i + 1}`,
      index: i,
      name: variantName(v.path, i),
      path: v.path,
      pathLabel: v.path.join(' → '),
      cases: v.cases,
      pct: cases ? Math.round((v.cases / cases) * 1000) / 10 : 0
    }));
  const dfg: ProcessMiningDfgEdge[] = [...dfgMap.values()]
    .sort((a, b) => b.frequency - a.frequency || a.source.localeCompare(b.source))
    .map((e, i) => ({
      id: `d-${i + 1}`,
      index: i,
      source: e.source,
      target: e.target,
      sourceName: e.source,
      targetName: e.target,
      frequency: e.frequency,
      pct: cases ? Math.round((e.frequency / cases) * 1000) / 10 : 0
    }));
  const activities: ProcessMiningActivity[] = [...activityMap.entries()]
    .sort((a, b) => b[1].frequency - a[1].frequency || a[0].localeCompare(b[0]))
    .map(([name, rec], i) => ({
      id: `a-${i + 1}`,
      index: i,
      name,
      frequency: rec.frequency,
      pct: cases ? Math.round((rec.frequency / cases) * 1000) / 10 : 0,
      startCount: rec.start,
      endCount: rec.end,
      avgDurationMs: 0
    }));
  if (!variants.length) warnings.push('No variants could be discovered.');
  if (!dfg.length && activities.length > 1) warnings.push('No directly-follows edges were discovered.');
  return {
    name: log.name,
    sourceKind: log.sourceKind,
    cases,
    events,
    activities,
    dfg,
    variants,
    warnings
  };
}

function parseMinedMapJson(data: Record<string, unknown>): ProcessMiningDataset {
  const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
  const dfgRaw = Array.isArray(data.dfg) ? data.dfg : Array.isArray(data.flows) ? data.flows : [];
  if (!variantsRaw.length && !dfgRaw.length) throw new Error('Mined map JSON is missing variants or DFG');
  const warnings = ['Loaded a pre-mined map (no event log traces).'];
  const variants: ProcessMiningVariant[] = variantsRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const path = Array.isArray(rec.path) ? rec.path.map((p) => String(p)) : splitPath(asString(rec.path ?? rec.sequence));
    return {
      id: asString(rec.id, `v-${i + 1}`),
      index: i,
      name: asString(rec.name, variantName(path, i)),
      path,
      pathLabel: path.join(' → '),
      cases: Math.max(0, asNumber(rec.cases ?? rec.count)),
      pct: 0
    };
  });
  const cases = variants.reduce((sum, v) => sum + v.cases, 0) || asNumber(data.cases);
  variants.forEach((v) => {
    v.pct = cases ? Math.round((v.cases / cases) * 1000) / 10 : 0;
  });
  variants.sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
  variants.forEach((v, i) => {
    v.index = i;
  });
  const dfg: ProcessMiningDfgEdge[] = dfgRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const source = asString(rec.source ?? rec.from);
    const target = asString(rec.target ?? rec.to);
    return {
      id: asString(rec.id, `d-${i + 1}`),
      index: i,
      source,
      target,
      sourceName: source,
      targetName: target,
      frequency: Math.max(0, asNumber(rec.frequency ?? rec.count)),
      pct: cases ? Math.round((asNumber(rec.frequency ?? rec.count) / cases) * 1000) / 10 : 0
    };
  });
  const activityMap = new Map<string, { frequency: number; start: number; end: number }>();
  for (const v of variants) {
    if (!v.path.length) continue;
    for (const name of v.path) {
      const rec = activityMap.get(name) ?? { frequency: 0, start: 0, end: 0 };
      rec.frequency += v.cases;
      activityMap.set(name, rec);
    }
    const start = activityMap.get(v.path[0]);
    if (start) start.start += v.cases;
    const end = activityMap.get(v.path[v.path.length - 1]);
    if (end) end.end += v.cases;
  }
  const activities: ProcessMiningActivity[] = [...activityMap.entries()]
    .sort((a, b) => b[1].frequency - a[1].frequency || a[0].localeCompare(b[0]))
    .map(([name, rec], i) => ({
      id: `a-${i + 1}`,
      index: i,
      name,
      frequency: rec.frequency,
      pct: cases ? Math.round((rec.frequency / cases) * 1000) / 10 : 0,
      startCount: rec.start,
      endCount: rec.end,
      avgDurationMs: 0
    }));
  return {
    name: asString(data.name, 'Mined process'),
    sourceKind: 'json',
    cases,
    events: 0,
    activities,
    dfg,
    variants,
    warnings
  };
}

export function parseProcessMiningText(text: string, fileName = ''): ProcessMiningDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Process mining file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid process mining JSON');
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const rec = data as Record<string, unknown>;
      const hasLog = Array.isArray(rec.traces) || Array.isArray(rec.cases) || Array.isArray(rec.events);
      const hasMap = Array.isArray(rec.variants) || Array.isArray(rec.dfg) || Array.isArray(rec.flows);
      if (hasMap && !hasLog) return parseMinedMapJson(rec);
    }
  }
  return mineFromLog(parseRawEventLogText(trimmed, fileName));
}

export function parseProcessMiningBytes(bytes: Uint8Array, fileName = ''): ProcessMiningDataset {
  if (!bytes.length) throw new Error('Process mining file is empty');
  return parseProcessMiningText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterProcessMiningVariants(variants: ProcessMiningVariant[], query: string): ProcessMiningVariant[] {
  const q = query.trim().toLowerCase();
  if (!q) return variants;
  const tokens = q.split(/\s+/).filter(Boolean);
  return variants.filter((v) =>
    tokens.every((token) => {
      if (token === 'happy' || token === 'main') return v.index === 0 || /happy|main/i.test(v.name);
      if (token === 'reject' || token === 'exception') return /reject|exception|error/i.test(v.name + v.pathLabel);
      if (token.startsWith('variant:')) return v.name.toLowerCase().includes(token.slice(8)) || v.pathLabel.toLowerCase().includes(token.slice(8));
      return `${v.name} ${v.pathLabel} ${v.cases}`.toLowerCase().includes(token);
    })
  );
}

export function filterProcessMiningActivities(activities: ProcessMiningActivity[], query: string): ProcessMiningActivity[] {
  const q = query.trim().toLowerCase();
  if (!q) return activities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return activities.filter((a) =>
    tokens.every((token) => {
      if (token === 'hot' || token === 'frequent') return a.pct >= 70;
      if (token === 'rare') return a.pct < 40;
      if (token === 'start') return a.startCount > 0;
      if (token === 'end') return a.endCount > 0;
      if (token.startsWith('activity:')) return a.name.toLowerCase().includes(token.slice(9));
      return `${a.name} ${a.frequency}`.toLowerCase().includes(token);
    })
  );
}

export function filterProcessMiningDfg(edges: ProcessMiningDfgEdge[], query: string): ProcessMiningDfgEdge[] {
  const q = query.trim().toLowerCase();
  if (!q) return edges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return edges.filter((e) =>
    tokens.every((token) => `${e.sourceName} ${e.targetName} ${e.frequency}`.toLowerCase().includes(token))
  );
}

export type { ProcessMiningSourceKind };
