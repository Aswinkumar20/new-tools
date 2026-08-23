import type {
  ProcessTimelineDataset,
  ProcessTimelineItem,
  ProcessTimelineLane
} from '../types/process-timeline-viewer.types';
import { parseRawEventLogText } from './event-log-core.utils';

const DEFAULT_STEP_MS = 30 * 60 * 1000;

function toIso(ms: number): string {
  return ms ? new Date(ms).toISOString() : '';
}

function buildLanes(kind: 'case' | 'resource', items: ProcessTimelineItem[]): ProcessTimelineLane[] {
  const map = new Map<string, ProcessTimelineItem[]>();
  for (const item of items) {
    const key = kind === 'case' ? item.caseId : item.resource || 'unassigned';
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()].map(([name, laneItems], i) => {
    const times = laneItems.flatMap((it) => [it.startMs, it.endMs]).filter((ms) => ms > 0);
    return {
      id: `${kind}-${i + 1}`,
      index: i,
      name,
      kind,
      events: laneItems.length,
      durationMs: times.length ? Math.max(0, Math.max(...times) - Math.min(...times)) : 0,
      items: laneItems
    };
  });
}

export function parseProcessTimelineText(text: string, fileName = ''): ProcessTimelineDataset {
  const log = parseRawEventLogText(text, fileName);
  const warnings = [...log.warnings];
  const items: ProcessTimelineItem[] = [];
  log.traces.forEach((trace) => {
    trace.events.forEach((event, step) => {
      let startMs = event.timestampMs;
      if (!startMs) startMs = Date.parse('2024-01-01T08:00:00.000Z') + step * DEFAULT_STEP_MS;
      const next = trace.events[step + 1];
      let endMs = next?.timestampMs && next.timestampMs > startMs ? next.timestampMs : startMs + DEFAULT_STEP_MS;
      items.push({
        id: `e-${items.length + 1}`,
        index: items.length,
        caseId: trace.caseId,
        activity: event.activity,
        resource: event.resource || 'unassigned',
        startTime: event.timestamp || toIso(startMs),
        endTime: next?.timestamp || toIso(endMs),
        startMs,
        endMs,
        durationMs: Math.max(0, endMs - startMs)
      });
    });
  });
  if (!items.length) warnings.push('Timeline contains no dated events.');
  const times = items.flatMap((it) => [it.startMs, it.endMs]).filter((ms) => ms > 0);
  const startMs = times.length ? Math.min(...times) : 0;
  const endMs = times.length ? Math.max(...times) : 0;
  if (items.some((it) => !it.startMs)) warnings.push('Some events had missing timestamps and were placed sequentially.');
  return {
    name: log.name,
    sourceKind: log.sourceKind,
    startMs,
    endMs,
    items,
    caseLanes: buildLanes('case', items),
    resourceLanes: buildLanes('resource', items),
    warnings
  };
}

export function parseProcessTimelineBytes(bytes: Uint8Array, fileName = ''): ProcessTimelineDataset {
  if (!bytes.length) throw new Error('Timeline file is empty');
  return parseProcessTimelineText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterTimelineItems(items: ProcessTimelineItem[], query: string): ProcessTimelineItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((it) =>
    tokens.every((token) => {
      if (token === 'long') return it.durationMs >= 60 * 60 * 1000;
      if (token === 'short') return it.durationMs > 0 && it.durationMs < 45 * 60 * 1000;
      if (token.startsWith('case:')) return it.caseId.toLowerCase().includes(token.slice(5));
      if (token.startsWith('activity:')) return it.activity.toLowerCase().includes(token.slice(9));
      if (token.startsWith('resource:') || token.startsWith('lane:')) {
        const value = token.slice(token.indexOf(':') + 1);
        return it.resource.toLowerCase().includes(value);
      }
      return `${it.caseId} ${it.activity} ${it.resource}`.toLowerCase().includes(token);
    })
  );
}

export function filterTimelineLanes(lanes: ProcessTimelineLane[], query: string): ProcessTimelineLane[] {
  const q = query.trim().toLowerCase();
  if (!q) return lanes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return lanes.filter((lane) =>
    tokens.every((token) => {
      if (token.startsWith('lane:') || token.startsWith('resource:') || token.startsWith('case:')) {
        const value = token.slice(token.indexOf(':') + 1);
        return lane.name.toLowerCase().includes(value);
      }
      return `${lane.name} ${lane.kind}`.toLowerCase().includes(token) || lane.items.some((it) => it.activity.toLowerCase().includes(token));
    })
  );
}
