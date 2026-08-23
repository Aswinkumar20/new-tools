import type {
  BpmnAnalyticsActivity,
  BpmnAnalyticsDataset,
  BpmnAnalyticsFlow,
  BpmnAnalyticsSourceKind,
  BpmnAnalyticsStat
} from '../types/bpmn-analytics-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function classifyBpmnAnalyticsKind(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes('task') || v.includes('activity') || v.includes('subprocess') || v.includes('call')) return 'task';
  if (v.includes('gateway')) return 'gateway';
  if (v.includes('event')) return 'event';
  if (v.includes('flow')) return 'flow';
  return v || 'task';
}

export function bottleneckSeverity(score: number, waitMs: number, frequency: number): string {
  if (frequency <= 0 && waitMs <= 0) return 'info';
  if (waitMs >= 1_800_000 || score >= 600) return 'critical';
  if (waitMs >= 600_000 || score >= 200) return 'high';
  if (waitMs >= 180_000 || score >= 50) return 'medium';
  if (waitMs > 0 || score > 0) return 'low';
  return 'info';
}

export function computeBottleneckScore(frequency: number, avgDurationMs: number, waitMs: number): number {
  const load = Math.log10(Math.max(frequency, 0) + 1);
  return Math.round(((waitMs + avgDurationMs * 0.25) / 1000) * load * 10) / 10;
}

function finishDataset(
  name: string,
  processName: string,
  sourceKind: BpmnAnalyticsSourceKind,
  cases: number,
  activities: BpmnAnalyticsActivity[],
  flows: BpmnAnalyticsFlow[],
  warnings: string[]
): BpmnAnalyticsDataset {
  const ranked = [...activities].sort((a, b) => b.bottleneckScore - a.bottleneckScore || b.waitMs - a.waitMs);
  ranked.forEach((a, i) => {
    a.index = i;
  });
  const sevMap = new Map<string, BpmnAnalyticsStat>();
  for (const a of ranked) {
    const rec = sevMap.get(a.severity) ?? { name: a.severity, count: 0 };
    rec.count += 1;
    sevMap.set(a.severity, rec);
  }
  if (!ranked.length) warnings.push('BPMN analytics contains no activities.');
  return {
    name,
    processName,
    sourceKind,
    cases,
    activities: ranked,
    flows,
    severities: [...sevMap.values()].sort((a, b) => b.count - a.count),
    warnings
  };
}

function parseJsonAnalytics(data: Record<string, unknown>): BpmnAnalyticsDataset {
  const raw = Array.isArray(data.activities) ? data.activities : Array.isArray(data.tasks) ? data.tasks : null;
  if (!raw) throw new Error('BPMN analytics JSON is missing activities');
  const activities: BpmnAnalyticsActivity[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const frequency = Math.round(asNumber(row.frequency ?? row.count ?? row.cases));
    const avgDurationMs = Math.round(asNumber(row.avgDurationMs ?? row.avg_duration_ms ?? row.durationMs));
    const waitMs = Math.round(asNumber(row.waitMs ?? row.wait_ms ?? row.wait));
    const score = computeBottleneckScore(frequency, avgDurationMs, waitMs);
    return {
      id: asString(row.id, `a-${i + 1}`),
      index: i,
      name: asString(row.name ?? row.activity ?? row.task, `Activity ${i + 1}`),
      kind: classifyBpmnAnalyticsKind(asString(row.kind ?? row.type, 'task')),
      frequency,
      avgDurationMs,
      waitMs,
      failures: Math.round(asNumber(row.failures ?? row.errors)),
      bottleneckScore: score,
      severity: bottleneckSeverity(score, waitMs, frequency)
    };
  });
  const flowsRaw = Array.isArray(data.flows) ? data.flows : [];
  const flows: BpmnAnalyticsFlow[] = flowsRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(row.id, `f-${i + 1}`),
      name: asString(row.name),
      source: asString(row.source ?? row.sourceRef),
      target: asString(row.target ?? row.targetRef),
      frequency: Math.round(asNumber(row.frequency ?? row.count))
    };
  });
  return finishDataset(
    asString(data.name ?? data.title, 'BPMN analytics'),
    asString(data.process ?? data.processName, asString(data.name, 'Process')),
    'json',
    Math.round(asNumber(data.cases ?? data.caseCount)),
    activities,
    flows,
    []
  );
}

function parseBpmnStructure(xml: string): BpmnAnalyticsDataset {
  const processMatch = /<(?:[\w.-]+:)?process\b([^>]*)>/i.exec(xml);
  const processName = /name="([^"]+)"/i.exec(processMatch?.[1] ?? '')?.[1] || /id="([^"]+)"/i.exec(processMatch?.[1] ?? '')?.[1] || 'BPMN process';
  const activities: BpmnAnalyticsActivity[] = [];
  const tagRe = /<(?:[\w.-]+:)?(task|userTask|serviceTask|scriptTask|manualTask|receiveTask|sendTask|businessRuleTask|callActivity|subProcess|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|complexGateway|startEvent|endEvent|intermediateThrowEvent|intermediateCatchEvent)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = tagRe.exec(xml))) {
    const kindRaw = match[1];
    const id = /id="([^"]+)"/i.exec(match[2])?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = /name="([^"]+)"/i.exec(match[2])?.[1] || id;
    activities.push({
      id,
      index: activities.length,
      name,
      kind: classifyBpmnAnalyticsKind(kindRaw),
      frequency: 0,
      avgDurationMs: 0,
      waitMs: 0,
      failures: 0,
      bottleneckScore: 0,
      severity: 'info'
    });
  }
  const flows: BpmnAnalyticsFlow[] = [];
  const flowRe = /<(?:[\w.-]+:)?sequenceFlow\b([^>]*)\/?>/gi;
  while ((match = flowRe.exec(xml))) {
    const id = /id="([^"]+)"/i.exec(match[1])?.[1] || `f-${flows.length + 1}`;
    flows.push({
      id,
      name: /name="([^"]+)"/i.exec(match[1])?.[1] || '',
      source: /sourceRef="([^"]+)"/i.exec(match[1])?.[1] || '',
      target: /targetRef="([^"]+)"/i.exec(match[1])?.[1] || '',
      frequency: 0
    });
  }
  if (!activities.length) throw new Error('BPMN XML contains no tasks, events, or gateways');
  return finishDataset(
    processName,
    processName,
    'bpmn',
    0,
    activities,
    flows,
    ['BPMN diagram loaded without metrics — add a JSON/CSV analytics export for bottleneck overlays.']
  );
}

function parseCsvAnalytics(text: string): BpmnAnalyticsDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('BPMN analytics CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const nameI = idx('name') >= 0 ? idx('name') : idx('activity') >= 0 ? idx('activity') : idx('task');
  const freqI = idx('frequency') >= 0 ? idx('frequency') : idx('count') >= 0 ? idx('count') : idx('cases');
  if (nameI < 0 || freqI < 0) throw new Error('BPMN analytics CSV needs name and frequency columns');
  const idI = idx('id');
  const kindI = idx('kind') >= 0 ? idx('kind') : idx('type');
  const durI = idx('avg_duration_ms') >= 0 ? idx('avg_duration_ms') : idx('duration_ms') >= 0 ? idx('duration_ms') : idx('duration');
  const waitI = idx('wait_ms') >= 0 ? idx('wait_ms') : idx('wait');
  const failI = idx('failures') >= 0 ? idx('failures') : idx('errors');
  const activities: BpmnAnalyticsActivity[] = rows.slice(1).map((row, i) => {
    const frequency = Number(row[freqI]) || 0;
    const avgDurationMs = durI >= 0 ? Number(row[durI]) || 0 : 0;
    const waitMs = waitI >= 0 ? Number(row[waitI]) || 0 : 0;
    const score = computeBottleneckScore(frequency, avgDurationMs, waitMs);
    return {
      id: idI >= 0 ? row[idI] || `a-${i + 1}` : `a-${i + 1}`,
      index: i,
      name: row[nameI] || `Activity ${i + 1}`,
      kind: classifyBpmnAnalyticsKind(kindI >= 0 ? row[kindI] || 'task' : 'task'),
      frequency,
      avgDurationMs,
      waitMs,
      failures: failI >= 0 ? Number(row[failI]) || 0 : 0,
      bottleneckScore: score,
      severity: bottleneckSeverity(score, waitMs, frequency)
    };
  });
  return finishDataset('BPMN analytics CSV', 'Process', 'csv', 0, activities, [], []);
}

export function parseBpmnAnalyticsText(text: string, fileName = ''): BpmnAnalyticsDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('BPMN analytics file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid BPMN analytics JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('BPMN analytics JSON must be an object');
    const rec = data as Record<string, unknown>;
    if (typeof rec.bpmnXml === 'string' && rec.bpmnXml.trim() && !Array.isArray(rec.activities) && !Array.isArray(rec.tasks)) {
      return parseBpmnStructure(String(rec.bpmnXml));
    }
    return parseJsonAnalytics(rec);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'bpmn' || /<(?:[\w.-]+:)?definitions\b/i.test(trimmed) || /BPMN\/20100524/i.test(trimmed)) {
    return parseBpmnStructure(trimmed);
  }
  if (ext === 'csv' || (trimmed.includes(',') && /frequency|count|wait/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvAnalytics(trimmed);
  }
  throw new Error('No BPMN analytics found — use JSON metrics, CSV, or a .bpmn diagram');
}

export function parseBpmnAnalyticsBytes(bytes: Uint8Array, fileName = ''): BpmnAnalyticsDataset {
  if (!bytes.length) throw new Error('BPMN analytics file is empty');
  return parseBpmnAnalyticsText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterBpmnAnalyticsActivities(activities: BpmnAnalyticsActivity[], query: string): BpmnAnalyticsActivity[] {
  const q = query.trim().toLowerCase();
  if (!q) return activities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return activities.filter((a) =>
    tokens.every((token) => {
      if (['critical', 'high', 'medium', 'low', 'info'].includes(token)) return a.severity === token;
      if (['task', 'gateway', 'event', 'flow'].includes(token)) return a.kind === token;
      if (token === 'bottleneck') return ['critical', 'high'].includes(a.severity);
      if (token.startsWith('kind:')) return a.kind === token.slice(5);
      const hay = `${a.id} ${a.name} ${a.kind} ${a.severity} ${a.frequency} ${a.waitMs}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
