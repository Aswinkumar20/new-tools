import type {
  EventLogActivity,
  EventLogCase,
  EventLogDataset,
  EventLogEvent
} from '../types/event-log-viewer.types';
import { collapseActivityPath, parseRawEventLogText } from './event-log-core.utils';

export function parseEventLogText(text: string, fileName = ''): EventLogDataset {
  const log = parseRawEventLogText(text, fileName);
  const warnings = [...log.warnings];
  const events: EventLogEvent[] = [];
  const cases: EventLogCase[] = log.traces.map((trace, i) => {
    const path = collapseActivityPath(trace.events);
    const times = trace.events.map((e) => e.timestampMs).filter((ms) => ms > 0);
    const startMs = times.length ? Math.min(...times) : 0;
    const endMs = times.length ? Math.max(...times) : 0;
    const resources = [...new Set(trace.events.map((e) => e.resource).filter(Boolean))];
    for (const event of trace.events) {
      events.push({
        id: `e-${events.length + 1}`,
        index: events.length,
        caseId: trace.caseId,
        activity: event.activity,
        timestamp: event.timestamp,
        timestampMs: event.timestampMs,
        resource: event.resource,
        lifecycle: event.lifecycle
      });
    }
    return {
      id: `c-${i + 1}`,
      index: i,
      caseId: trace.caseId,
      events: trace.events.length,
      activities: path,
      pathLabel: path.join(' → '),
      startTime: trace.events.find((e) => e.timestamp)?.timestamp || '',
      endTime: [...trace.events].reverse().find((e) => e.timestamp)?.timestamp || '',
      durationMs: startMs && endMs ? Math.max(0, endMs - startMs) : 0,
      resources
    };
  });
  const activityMap = new Map<string, { frequency: number; cases: Set<string>; resources: Set<string> }>();
  for (const event of events) {
    const rec = activityMap.get(event.activity) ?? { frequency: 0, cases: new Set(), resources: new Set() };
    rec.frequency += 1;
    rec.cases.add(event.caseId);
    if (event.resource) rec.resources.add(event.resource);
    activityMap.set(event.activity, rec);
  }
  const totalCases = cases.length || 1;
  const activities: EventLogActivity[] = [...activityMap.entries()]
    .sort((a, b) => b[1].frequency - a[1].frequency || a[0].localeCompare(b[0]))
    .map(([name, rec], i) => ({
      id: `a-${i + 1}`,
      index: i,
      name,
      frequency: rec.frequency,
      pct: Math.round((rec.cases.size / totalCases) * 1000) / 10,
      cases: rec.cases.size,
      resources: [...rec.resources]
    }));
  if (!cases.length) warnings.push('Event log contains no cases.');
  if (!events.length) warnings.push('Event log contains no events.');
  return {
    name: log.name,
    sourceKind: log.sourceKind,
    cases,
    activities,
    events,
    warnings
  };
}

export function parseEventLogBytes(bytes: Uint8Array, fileName = ''): EventLogDataset {
  if (!bytes.length) throw new Error('Event log file is empty');
  return parseEventLogText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterEventLogCases(cases: EventLogCase[], query: string): EventLogCase[] {
  const q = query.trim().toLowerCase();
  if (!q) return cases;
  const tokens = q.split(/\s+/).filter(Boolean);
  return cases.filter((c) =>
    tokens.every((token) => {
      if (token === 'long') return c.events >= 5;
      if (token === 'short') return c.events <= 3;
      if (token.startsWith('case:')) return c.caseId.toLowerCase().includes(token.slice(5));
      return `${c.caseId} ${c.pathLabel} ${c.resources.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterEventLogActivities(activities: EventLogActivity[], query: string): EventLogActivity[] {
  const q = query.trim().toLowerCase();
  if (!q) return activities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return activities.filter((a) =>
    tokens.every((token) => {
      if (token === 'hot' || token === 'frequent') return a.pct >= 70;
      if (token === 'rare') return a.pct < 40;
      if (token.startsWith('activity:')) return a.name.toLowerCase().includes(token.slice(9));
      return `${a.name} ${a.frequency} ${a.resources.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterEventLogEvents(events: EventLogEvent[], query: string): EventLogEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  const tokens = q.split(/\s+/).filter(Boolean);
  return events.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('case:')) return e.caseId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('activity:')) return e.activity.toLowerCase().includes(token.slice(9));
      if (token.startsWith('resource:')) return e.resource.toLowerCase().includes(token.slice(9));
      return `${e.caseId} ${e.activity} ${e.resource} ${e.timestamp}`.toLowerCase().includes(token);
    })
  );
}
