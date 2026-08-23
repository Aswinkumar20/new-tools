export type RawLogSourceKind = 'xes' | 'json' | 'csv';

export interface RawLogEvent {
  activity: string;
  timestamp: string;
  timestampMs: number;
  resource: string;
  lifecycle: string;
  attributes: Record<string, string>;
}

export interface RawLogTrace {
  caseId: string;
  events: RawLogEvent[];
  attributes: Record<string, string>;
}

export interface RawLogParse {
  name: string;
  sourceKind: RawLogSourceKind;
  traces: RawLogTrace[];
  warnings: string[];
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function parseTimestamp(raw: string): { timestamp: string; timestampMs: number } {
  const timestamp = asString(raw);
  const timestampMs = Date.parse(timestamp);
  return { timestamp, timestampMs: Number.isFinite(timestampMs) ? timestampMs : 0 };
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

function xesAttr(block: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const valueAttr =
    new RegExp(
      `<(?:[\\w.-]+:)?(?:string|date|int|float|boolean|id)\\b[^>]*\\bkey="${escaped}"[^>]*\\bvalue="([^"]*)"`,
      'i'
    ).exec(block) ||
    new RegExp(
      `<(?:[\\w.-]+:)?(?:string|date|int|float|boolean|id)\\b[^>]*\\bvalue="([^"]*)"[^>]*\\bkey="${escaped}"`,
      'i'
    ).exec(block);
  if (valueAttr) return decodeXml(valueAttr[1]);
  const inner = new RegExp(
    `<(?:[\\w.-]+:)?(?:string|date|int|float|boolean|id)\\b[^>]*\\bkey="${escaped}"[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?(?:string|date|int|float|boolean|id)>`,
    'i'
  ).exec(block);
  return inner ? decodeXml(inner[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : '';
}

const KNOWN_ATTR_SKIP = new Set([
  'concept:name',
  'activity',
  'time:timestamp',
  'timestamp',
  'org:resource',
  'resource',
  'lifecycle:transition',
  'lifecycle',
  'case',
  'caseid',
  'case_id',
  'id'
]);

function xesAllAttrs(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<(?:[\w.-]+:)?(?:string|date|int|float|boolean|id)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    const tag = match[1];
    const key = /(?:^|\s)key="([^"]*)"/i.exec(tag)?.[1];
    const value = /(?:^|\s)value="([^"]*)"/i.exec(tag)?.[1];
    if (!key || KNOWN_ATTR_SKIP.has(key)) continue;
    out[key] = decodeXml(value || '');
  }
  return out;
}

function extraObjectAttrs(rec: Record<string, unknown>, extraSkip: string[] = []): Record<string, string> {
  const skip = new Set([...KNOWN_ATTR_SKIP, ...extraSkip, 'events', 'attributes', 'name', 'path']);
  const out: Record<string, string> = {};
  if (rec.attributes && typeof rec.attributes === 'object' && !Array.isArray(rec.attributes)) {
    for (const [key, value] of Object.entries(rec.attributes as Record<string, unknown>)) {
      if (value != null && String(value).trim()) out[key] = String(value).trim();
    }
  }
  for (const [key, value] of Object.entries(rec)) {
    if (skip.has(key.toLowerCase()) || skip.has(key) || value == null || typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) out[key] = text;
  }
  return out;
}

function makeEvent(
  activity: string,
  timestampRaw: string,
  resource: string,
  lifecycle: string,
  attributes: Record<string, string> = {}
): RawLogEvent {
  const ts = parseTimestamp(timestampRaw);
  return {
    activity: activity || 'unknown',
    timestamp: ts.timestamp,
    timestampMs: ts.timestampMs,
    resource,
    lifecycle,
    attributes
  };
}

function parseXes(xml: string): RawLogParse {
  if (!/<(?:[\w.-]+:)?(log|trace)\b/i.test(xml)) throw new Error('Not an XES event log');
  const warnings: string[] = [];
  const name = xesAttr(xml.slice(0, xml.search(/<(?:[\w.-]+:)?trace\b/i) || xml.length), 'concept:name') || 'Event log';
  const traces: RawLogTrace[] = [];
  const traceRe = /<(?:[\w.-]+:)?trace\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?trace>/gi;
  let traceMatch: RegExpExecArray | null;
  while ((traceMatch = traceRe.exec(xml))) {
    const block = traceMatch[1];
    const events: RawLogEvent[] = [];
    const eventRe = /<(?:[\w.-]+:)?event\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?event>/gi;
    let eventMatch: RegExpExecArray | null;
    while ((eventMatch = eventRe.exec(block))) {
      const inner = eventMatch[1];
      events.push(
        makeEvent(
          xesAttr(inner, 'concept:name') || xesAttr(inner, 'activity'),
          xesAttr(inner, 'time:timestamp') || xesAttr(inner, 'timestamp'),
          xesAttr(inner, 'org:resource') || xesAttr(inner, 'resource'),
          xesAttr(inner, 'lifecycle:transition') || xesAttr(inner, 'lifecycle'),
          xesAllAttrs(inner)
        )
      );
    }
    const head = block.slice(0, block.search(/<(?:[\w.-]+:)?event\b/i) || block.length);
    traces.push({
      caseId: xesAttr(block, 'concept:name') || `case-${traces.length + 1}`,
      events,
      attributes: xesAllAttrs(head)
    });
  }
  if (!traces.length) throw new Error('XES log contains no traces');
  if (traces.some((t) => !t.events.length)) warnings.push('Some traces have no events.');
  return { name, sourceKind: 'xes', traces, warnings };
}

function parseJson(data: Record<string, unknown>): RawLogParse {
  const name = asString(data.name ?? data.logName, 'Event log');
  const warnings: string[] = [];
  let tracesRaw: unknown[] | null = null;
  if (Array.isArray(data.traces)) tracesRaw = data.traces;
  else if (Array.isArray(data.cases)) tracesRaw = data.cases;
  else if (Array.isArray(data.log)) tracesRaw = data.log;

  if (tracesRaw) {
    const traces: RawLogTrace[] = tracesRaw.map((item, i) => {
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const eventsRaw = Array.isArray(rec.events) ? rec.events : [];
      return {
        caseId: asString(rec.caseId ?? rec.id ?? rec.case, `case-${i + 1}`),
        attributes: extraObjectAttrs(rec, ['caseid', 'case_id']),
        events: eventsRaw.map((event) => {
          const e = (event && typeof event === 'object' ? event : {}) as Record<string, unknown>;
          return makeEvent(
            asString(e.activity ?? e.name ?? e['concept:name']),
            asString(e.timestamp ?? e.time ?? e['time:timestamp']),
            asString(e.resource ?? e['org:resource']),
            asString(e.lifecycle ?? e['lifecycle:transition']),
            extraObjectAttrs(e)
          );
        })
      };
    });
    if (!traces.length) throw new Error('Event log JSON contains no traces');
    return { name, sourceKind: 'json', traces, warnings };
  }

  const eventsRaw = Array.isArray(data.events) ? data.events : null;
  if (!eventsRaw) throw new Error('Event log JSON is missing traces, cases, or events');
  const grouped = new Map<string, RawLogEvent[]>();
  for (const item of eventsRaw) {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const caseId = asString(rec.caseId ?? rec.case ?? rec.id, 'case-1');
    const list = grouped.get(caseId) ?? [];
    list.push(
      makeEvent(
        asString(rec.activity ?? rec.name ?? rec['concept:name']),
        asString(rec.timestamp ?? rec.time ?? rec['time:timestamp']),
        asString(rec.resource ?? rec['org:resource']),
        asString(rec.lifecycle ?? rec['lifecycle:transition']),
        extraObjectAttrs(rec, ['caseid', 'case_id'])
      )
    );
    grouped.set(caseId, list);
  }
  const traces = [...grouped.entries()].map(([caseId, events]) => ({
    caseId,
    events,
    attributes: events[0]?.attributes ?? {}
  }));
  if (!traces.length) throw new Error('Event log JSON contains no events');
  return { name, sourceKind: 'json', traces, warnings };
}

function parseCsv(text: string): RawLogParse {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Event log CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (names: string[]): number => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const caseI = idx(['case', 'case_id', 'caseid', 'trace', 'id']);
  const activityI = idx(['activity', 'concept_name', 'name', 'event']);
  if (caseI < 0 || activityI < 0) throw new Error('Event log CSV needs case and activity columns');
  const timeI = idx(['timestamp', 'time', 'time_timestamp', 'datetime']);
  const resourceI = idx(['resource', 'org_resource', 'user', 'agent']);
  const lifecycleI = idx(['lifecycle', 'lifecycle_transition', 'transition']);
  const extraIndexes = header
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== caseI && i !== activityI && i !== timeI && i !== resourceI && i !== lifecycleI);
  const grouped = new Map<string, { events: RawLogEvent[]; attributes: Record<string, string> }>();
  for (const row of rows.slice(1)) {
    const caseId = row[caseI] || 'case-1';
    const rec = grouped.get(caseId) ?? { events: [], attributes: {} };
    const attributes: Record<string, string> = {};
    for (const extra of extraIndexes) {
      const value = row[extra.i] || '';
      if (value) attributes[header[extra.i]] = value;
    }
    rec.events.push(
      makeEvent(
        row[activityI] || '',
        timeI >= 0 ? row[timeI] || '' : '',
        resourceI >= 0 ? row[resourceI] || '' : '',
        lifecycleI >= 0 ? row[lifecycleI] || '' : '',
        attributes
      )
    );
    if (!Object.keys(rec.attributes).length) rec.attributes = { ...attributes };
    grouped.set(caseId, rec);
  }
  const traces = [...grouped.entries()].map(([caseId, rec]) => ({
    caseId,
    events: rec.events,
    attributes: rec.attributes
  }));
  if (!traces.length) throw new Error('Event log CSV contains no events');
  return { name: 'Event log CSV', sourceKind: 'csv', traces, warnings: [] };
}

export function parseRawEventLogText(text: string, fileName = ''): RawLogParse {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Event log file is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid event log JSON');
    }
    if (Array.isArray(data)) data = { name: 'Event log', events: data };
    if (!data || typeof data !== 'object') throw new Error('Event log JSON must be an object');
    return parseJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  const header = trimmed.split('\n')[0] || '';
  if (
    ext === 'csv' ||
    (trimmed.includes(',') && /case/i.test(header) && /activity|event|name/i.test(header))
  ) {
    return parseCsv(trimmed);
  }
  if (ext === 'xes' || ext === 'xml' || /^</.test(trimmed)) return parseXes(trimmed);
  throw new Error('No event log found — use XES, XML, JSON, or CSV');
}

export function parseRawEventLogBytes(bytes: Uint8Array, fileName = ''): RawLogParse {
  if (!bytes.length) throw new Error('Event log file is empty');
  return parseRawEventLogText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function collapseActivityPath(events: RawLogEvent[]): string[] {
  const names: string[] = [];
  for (const event of events) {
    const name = event.activity.trim();
    if (!name) continue;
    if (names[names.length - 1] !== name) names.push(name);
  }
  return names;
}
