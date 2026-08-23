import type {
  ProcessMapActivity,
  ProcessMapDataset,
  ProcessMapFlow,
  ProcessMapSourceKind,
  ProcessMapVariant
} from '../types/process-map-viewer.types';

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

function splitPath(raw: string): string[] {
  return raw
    .split(/>|,|\||->/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function finishDataset(
  name: string,
  sourceKind: ProcessMapSourceKind,
  cases: number,
  activities: ProcessMapActivity[],
  flows: ProcessMapFlow[],
  variants: ProcessMapVariant[],
  warnings: string[]
): ProcessMapDataset {
  const totalCases = cases || variants.reduce((sum, v) => sum + v.cases, 0);
  const maxAct = Math.max(...activities.map((a) => a.frequency), 1);
  activities.forEach((a) => {
    a.pct = totalCases ? Math.round((a.frequency / totalCases) * 1000) / 10 : Math.round((a.frequency / maxAct) * 1000) / 10;
  });
  const maxFlow = Math.max(...flows.map((f) => f.frequency), 1);
  flows.forEach((f) => {
    f.pct = totalCases ? Math.round((f.frequency / totalCases) * 1000) / 10 : Math.round((f.frequency / maxFlow) * 1000) / 10;
  });
  variants.forEach((v) => {
    v.pct = totalCases ? Math.round((v.cases / totalCases) * 1000) / 10 : 0;
    if (!v.pathLabel) v.pathLabel = v.path.join(' → ');
  });
  variants.sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
  variants.forEach((v, i) => {
    v.index = i;
  });
  if (!activities.length && !variants.length) warnings.push('Process map contains no activities or variants.');
  if (!variants.length && activities.length) warnings.push('Process map has activities but no variants.');
  return {
    name,
    sourceKind,
    cases: totalCases,
    activities,
    flows,
    variants,
    warnings
  };
}

function parseProcessMapJson(data: Record<string, unknown>): ProcessMapDataset {
  const activitiesRaw = Array.isArray(data.activities) ? data.activities : null;
  const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
  if (!activitiesRaw && !variantsRaw.length) throw new Error('Process map JSON is missing activities or variants');
  const cases = asNumber(data.cases ?? data.caseCount);
  const activities: ProcessMapActivity[] = (activitiesRaw || []).map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `a-${i + 1}`),
      index: i,
      name: asString(rec.name, `Activity ${i + 1}`),
      frequency: Math.max(0, asNumber(rec.frequency ?? rec.count ?? rec.cases)),
      pct: 0,
      avgDurationMs: Math.max(0, asNumber(rec.avgDurationMs ?? rec.duration))
    };
  });
  const flowsRaw = Array.isArray(data.flows) ? data.flows : Array.isArray(data.dfg) ? data.dfg : [];
  const flows: ProcessMapFlow[] = flowsRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const source = asString(rec.source ?? rec.from);
    const target = asString(rec.target ?? rec.to);
    return {
      id: asString(rec.id, `f-${i + 1}`),
      index: i,
      source,
      target,
      sourceName: asString(rec.sourceName, source),
      targetName: asString(rec.targetName, target),
      frequency: Math.max(0, asNumber(rec.frequency ?? rec.count)),
      pct: 0
    };
  });
  const variants: ProcessMapVariant[] = variantsRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const path = Array.isArray(rec.path)
      ? rec.path.map((p) => String(p))
      : splitPath(asString(rec.path ?? rec.sequence ?? rec.trace));
    const vCases = Math.max(0, asNumber(rec.cases ?? rec.count ?? rec.frequency));
    return {
      id: asString(rec.id, `v-${i + 1}`),
      index: i,
      name: asString(rec.name, `Variant ${i + 1}`),
      path,
      pathLabel: path.join(' → '),
      cases: vCases,
      pct: 0
    };
  });
  return finishDataset(asString(data.name, 'Process map'), 'json', cases, activities, flows, variants, []);
}

function parseProcessMapXml(xml: string): ProcessMapDataset {
  if (!/<(?:[\w.-]+:)?(processMap|process-map|dfg|directlyFollowsGraph)\b/i.test(xml) && !/<(?:[\w.-]+:)?(activity|variant|flow)\b/i.test(xml)) {
    throw new Error('Not a process map document');
  }
  const root = /<(?:[\w.-]+:)?(processMap|process-map|dfg)\b([^>]*)>/i.exec(xml)?.[2] ?? '';
  const ra = attrs(root);
  const name = ra.name || 'Process map';
  const cases = asNumber(ra.cases ?? ra.caseCount);
  const activities: ProcessMapActivity[] = [];
  const actRe =
    /<(?:[\w.-]+:)?activity\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = actRe.exec(xml))) {
    const a = attrs(match[1]);
    activities.push({
      id: a.id || `a-${activities.length + 1}`,
      index: activities.length,
      name: a.name || a.id || `Activity ${activities.length + 1}`,
      frequency: Math.max(0, asNumber(a.frequency ?? a.count ?? a.cases)),
      pct: 0,
      avgDurationMs: Math.max(0, asNumber(a.avgDurationMs ?? a.duration))
    });
  }
  const flows: ProcessMapFlow[] = [];
  const flowRe = /<(?:[\w.-]+:)?(flow|arc|dfgEdge)\b([^>]*)\/?>/gi;
  while ((match = flowRe.exec(xml))) {
    const a = attrs(match[2]);
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    flows.push({
      id: a.id || `f-${flows.length + 1}`,
      index: flows.length,
      source,
      target,
      sourceName: source,
      targetName: target,
      frequency: Math.max(0, asNumber(a.frequency ?? a.count)),
      pct: 0
    });
  }
  const variants: ProcessMapVariant[] = [];
  const varRe = /<(?:[\w.-]+:)?variant\b([^>]*)\/?>/gi;
  while ((match = varRe.exec(xml))) {
    const a = attrs(match[1]);
    const path = splitPath(a.path || a.sequence || '');
    variants.push({
      id: a.id || `v-${variants.length + 1}`,
      index: variants.length,
      name: a.name || `Variant ${variants.length + 1}`,
      path,
      pathLabel: path.join(' → '),
      cases: Math.max(0, asNumber(a.cases ?? a.count ?? a.frequency)),
      pct: 0
    });
  }
  if (!activities.length && !variants.length) throw new Error('Process map contains no activities or variants');
  return finishDataset(name, 'xml', cases, activities, flows, variants, []);
}

function parseProcessMapCsv(text: string): ProcessMapDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Process map CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const typeI = idx('type') >= 0 ? idx('type') : idx('kind');
  const nameI = idx('name');
  if (typeI < 0 || nameI < 0) throw new Error('Process map CSV needs type and name columns');
  const freqI = idx('frequency') >= 0 ? idx('frequency') : idx('count');
  const pathI = idx('path') >= 0 ? idx('path') : idx('sequence');
  const casesI = idx('cases');
  const activities: ProcessMapActivity[] = [];
  const flows: ProcessMapFlow[] = [];
  const variants: ProcessMapVariant[] = [];
  rows.slice(1).forEach((row) => {
    const type = (row[typeI] || '').toLowerCase();
    const name = row[nameI] || '';
    const frequency = Math.max(0, asNumber(freqI >= 0 ? row[freqI] : 0));
    if (type === 'activity') {
      activities.push({
        id: `a-${activities.length + 1}`,
        index: activities.length,
        name,
        frequency,
        pct: 0,
        avgDurationMs: 0
      });
    } else if (type === 'flow' || type === 'arc') {
      const parts = splitPath(name || (pathI >= 0 ? row[pathI] : ''));
      const source = parts[0] || '';
      const target = parts[1] || '';
      if (!source || !target) return;
      flows.push({
        id: `f-${flows.length + 1}`,
        index: flows.length,
        source,
        target,
        sourceName: source,
        targetName: target,
        frequency,
        pct: 0
      });
    } else if (type === 'variant') {
      const path = splitPath(pathI >= 0 ? row[pathI] || '' : '');
      variants.push({
        id: `v-${variants.length + 1}`,
        index: variants.length,
        name,
        path,
        pathLabel: path.join(' → '),
        cases: Math.max(0, asNumber(casesI >= 0 ? row[casesI] : frequency)),
        pct: 0
      });
    }
  });
  if (!activities.length && !variants.length) throw new Error('Process map CSV contains no activities or variants');
  return finishDataset('Process map CSV', 'csv', 0, activities, flows, variants, []);
}

export function parseProcessMapText(text: string, fileName = ''): ProcessMapDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Process map file is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid process map JSON');
    }
    if (Array.isArray(data)) data = { name: 'Process map', variants: data };
    if (!data || typeof data !== 'object') throw new Error('Process map JSON must be an object');
    return parseProcessMapJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /type|kind/i.test(trimmed.split('\n')[0] || '') && /name/i.test(trimmed.split('\n')[0] || ''))) {
    return parseProcessMapCsv(trimmed);
  }
  if (ext === 'xml' || /^</.test(trimmed)) return parseProcessMapXml(trimmed);
  throw new Error('No process map found — use JSON, XML, or CSV');
}

export function parseProcessMapBytes(bytes: Uint8Array, fileName = ''): ProcessMapDataset {
  if (!bytes.length) throw new Error('Process map file is empty');
  return parseProcessMapText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterProcessMapActivities(activities: ProcessMapActivity[], query: string): ProcessMapActivity[] {
  const q = query.trim().toLowerCase();
  if (!q) return activities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return activities.filter((a) =>
    tokens.every((token) => {
      if (token === 'hot' || token === 'frequent') return a.pct >= 70;
      if (token === 'rare') return a.pct < 30;
      if (token.startsWith('activity:')) return a.name.toLowerCase().includes(token.slice(9));
      return `${a.id} ${a.name} ${a.frequency}`.toLowerCase().includes(token);
    })
  );
}

export function filterProcessMapVariants(variants: ProcessMapVariant[], query: string): ProcessMapVariant[] {
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

export function filterProcessMapFlows(flows: ProcessMapFlow[], query: string): ProcessMapFlow[] {
  const q = query.trim().toLowerCase();
  if (!q) return flows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return flows.filter((f) =>
    tokens.every((token) => `${f.sourceName} ${f.targetName} ${f.frequency}`.toLowerCase().includes(token))
  );
}
