import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  details: string;
  raw: unknown;
}

export function isAuditLogFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.json') ||
    name.endsWith('.jsonl') ||
    name.endsWith('.csv') ||
    name.endsWith('.txt') ||
    file.type === 'application/json' ||
    file.type === 'text/csv' ||
    file.type === 'text/plain'
  );
}

export function parseAuditLogContent(content: string, fileName: string): AuditLogEvent[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jsonl')) {
    return parseAuditJsonl(content);
  }
  if (lower.endsWith('.csv')) {
    return parseAuditCsv(content);
  }

  const trimmed = content.trim();
  if (trimmed.startsWith('[')) {
    const rows = JSON.parse(trimmed) as unknown[];
    return rows.map((row, index) => normalizeAuditEvent(row, index));
  }
  if (trimmed.startsWith('{')) {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const events = obj['events'] ?? obj['records'] ?? obj['items'] ?? obj['logs'];
    if (Array.isArray(events)) {
      return events.map((row, index) => normalizeAuditEvent(row, index));
    }
    return [normalizeAuditEvent(obj, 0)];
  }

  return parseAuditJsonl(trimmed);
}

function parseAuditJsonl(content: string): AuditLogEvent[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => normalizeAuditEvent(JSON.parse(line), index));
}

function parseAuditCsv(content: string): AuditLogEvent[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const headers = splitCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = values[i] ?? '';
    });
    return normalizeAuditEvent(record, index);
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? '';
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function normalizeAuditEvent(raw: unknown, index: number): AuditLogEvent {
  const record = (raw ?? {}) as Record<string, unknown>;
  const actor = pickString(record, ['actor', 'user', 'username', 'email', 'principal', 'performed_by']) ?? 'Unknown';
  const action = pickString(record, ['action', 'event', 'operation', 'type', 'activity']) ?? '—';
  const resource = pickString(record, ['resource', 'target', 'object', 'entity', 'asset']) ?? '—';
  const timestamp =
    pickString(record, ['timestamp', 'time', 'date', 'created_at', 'occurred_at', 'event_time']) ??
    new Date(0).toISOString();
  const details =
    pickString(record, ['details', 'message', 'description', 'summary']) ??
    JSON.stringify(record);

  return {
    id: `evt-${index + 1}`,
    timestamp,
    actor,
    action,
    resource,
    details,
    raw: record
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

export function filterAuditEvents(events: AuditLogEvent[], query: string, actor: string): AuditLogEvent[] {
  const q = query.trim().toLowerCase();
  const actorFilter = actor.trim().toLowerCase();
  return events.filter((event) => {
    const actorMatch = !actorFilter || event.actor.toLowerCase().includes(actorFilter);
    const queryMatch =
      !q ||
      event.action.toLowerCase().includes(q) ||
      event.resource.toLowerCase().includes(q) ||
      event.details.toLowerCase().includes(q) ||
      event.actor.toLowerCase().includes(q);
    return actorMatch && queryMatch;
  });
}

export function collectAuditActors(events: AuditLogEvent[]): string[] {
  return [...new Set(events.map((event) => event.actor))].sort((a, b) => a.localeCompare(b));
}

export function formatAuditTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export function resolveAuditSuggestion(options: {
  hasEvents: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'al-log',
      title: 'Plain log file?',
      reason: 'Log Viewer parses unstructured application logs with level filters.',
      actionLabel: 'Open Log Viewer',
      path: '/file-viewers/log-viewer'
    };
  }
  if (!options.hasEvents) {
    return {
      id: 'al-log-empty',
      title: 'Need generic log parsing?',
      reason: 'Log Viewer handles .log and .txt exports with search and stats.',
      actionLabel: 'Open Log Viewer',
      path: '/file-viewers/log-viewer'
    };
  }
  return null;
}
