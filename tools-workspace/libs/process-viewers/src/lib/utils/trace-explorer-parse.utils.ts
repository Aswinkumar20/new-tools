import type {
  TraceAttributePair,
  TraceAttributeStat,
  TraceCase,
  TraceExplorerDataset,
  TraceStep
} from '../types/trace-explorer.types';
import { collapseActivityPath, parseRawEventLogText } from './event-log-core.utils';

function pairs(attrs: Record<string, string> | undefined): TraceAttributePair[] {
  return Object.entries(attrs || {})
    .filter(([, value]) => value)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function parseTraceExplorerText(text: string, fileName = ''): TraceExplorerDataset {
  const log = parseRawEventLogText(text, fileName);
  const warnings = [...log.warnings];
  const steps: TraceStep[] = [];
  const traces: TraceCase[] = log.traces.map((trace, i) => {
    const path = collapseActivityPath(trace.events);
    const times = trace.events.map((e) => e.timestampMs).filter((ms) => ms > 0);
    const startMs = times.length ? Math.min(...times) : 0;
    const endMs = times.length ? Math.max(...times) : 0;
    const caseAttrs = { ...(trace.attributes || {}) };
    if (!Object.keys(caseAttrs).length && trace.events[0]?.attributes) Object.assign(caseAttrs, trace.events[0].attributes);
    trace.events.forEach((event, step) => {
      const next = trace.events[step + 1];
      const durationMs =
        event.timestampMs && next?.timestampMs && next.timestampMs > event.timestampMs
          ? next.timestampMs - event.timestampMs
          : 0;
      steps.push({
        id: `s-${steps.length + 1}`,
        index: steps.length,
        caseId: trace.caseId,
        step: step + 1,
        activity: event.activity,
        timestamp: event.timestamp,
        timestampMs: event.timestampMs,
        resource: event.resource,
        lifecycle: event.lifecycle,
        durationMs,
        attributes: pairs(event.attributes)
      });
    });
    return {
      id: `t-${i + 1}`,
      index: i,
      caseId: trace.caseId,
      path,
      pathLabel: path.join(' → '),
      events: trace.events.length,
      durationMs: startMs && endMs ? Math.max(0, endMs - startMs) : 0,
      startTime: trace.events.find((e) => e.timestamp)?.timestamp || '',
      endTime: [...trace.events].reverse().find((e) => e.timestamp)?.timestamp || '',
      resources: [...new Set(trace.events.map((e) => e.resource).filter(Boolean))],
      attributes: pairs(caseAttrs)
    };
  });
  const attrMap = new Map<string, Map<string, number>>();
  for (const trace of traces) {
    for (const attr of trace.attributes) {
      const values = attrMap.get(attr.key) ?? new Map<string, number>();
      values.set(attr.value, (values.get(attr.value) ?? 0) + 1);
      attrMap.set(attr.key, values);
    }
  }
  const total = traces.length || 1;
  const attributes: TraceAttributeStat[] = [...attrMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, values], i) => ({
      id: `a-${i + 1}`,
      index: i,
      key,
      distinct: values.size,
      values: [...values.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count, pct: Math.round((count / total) * 1000) / 10 }))
    }));
  if (!traces.length) warnings.push('Trace file contains no cases.');
  if (!attributes.length) warnings.push('No case attributes were found.');
  return { name: log.name, sourceKind: log.sourceKind, traces, steps, attributes, warnings };
}

export function parseTraceExplorerBytes(bytes: Uint8Array, fileName = ''): TraceExplorerDataset {
  if (!bytes.length) throw new Error('Trace file is empty');
  return parseTraceExplorerText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterTraceCases(traces: TraceCase[], query: string): TraceCase[] {
  const q = query.trim().toLowerCase();
  if (!q) return traces;
  const tokens = q.split(/\s+/).filter(Boolean);
  return traces.filter((t) =>
    tokens.every((token) => {
      if (token === 'long') return t.events >= 4;
      if (token === 'short') return t.events <= 3;
      if (token === 'approve' || token === 'happy') return /approve|pay/i.test(t.pathLabel);
      if (token === 'reject') return /reject/i.test(t.pathLabel);
      if (token.startsWith('case:')) return t.caseId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('attr:') || token.includes('=')) {
        const body = token.startsWith('attr:') ? token.slice(5) : token;
        const [key, value] = body.split('=');
        if (!key) return false;
        return t.attributes.some((a) => a.key.toLowerCase() === key && (!value || a.value.toLowerCase().includes(value)));
      }
      return `${t.caseId} ${t.pathLabel} ${t.attributes.map((a) => `${a.key}:${a.value}`).join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterTraceSteps(steps: TraceStep[], query: string): TraceStep[] {
  const q = query.trim().toLowerCase();
  if (!q) return steps;
  const tokens = q.split(/\s+/).filter(Boolean);
  return steps.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('case:')) return s.caseId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('activity:')) return s.activity.toLowerCase().includes(token.slice(9));
      return `${s.caseId} ${s.activity} ${s.resource}`.toLowerCase().includes(token);
    })
  );
}

export function filterTraceAttributes(attributes: TraceAttributeStat[], query: string): TraceAttributeStat[] {
  const q = query.trim().toLowerCase();
  if (!q) return attributes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return attributes.filter((a) =>
    tokens.every((token) => `${a.key} ${a.values.map((v) => v.value).join(' ')}`.toLowerCase().includes(token))
  );
}
