import { EVENT_LOG_CSV_SAMPLE } from '../constants/event-log-sample.data';
import { EVENT_LOG_MAX_FILE_BYTES, EVENT_LOG_SUPPORTED_EXTENSIONS } from '../constants/event-log-viewer.constants';
import type {
  EventLogActivity,
  EventLogCase,
  EventLogDataset,
  EventLogEvent,
  EventLogLoadedFile,
  EventLogMetadataRow,
  EventLogSuggestion
} from '../types/event-log-viewer.types';
import { parseEventLogBytes } from './event-log-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatEventLogFileSize,
  readFileBytes as readEventLogFileBytes
} from './process-file.utils';

export {
  filterEventLogActivities,
  filterEventLogCases,
  filterEventLogEvents,
  parseEventLogBytes,
  parseEventLogText
} from './event-log-parse.utils';
export {
  eventLogCaseColor,
  eventLogFrequencyColor,
  renderEventLogActivities,
  renderEventLogCases,
  renderEventLogEvents
} from './event-log-render.utils';

export function isSupportedEventLogFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (EVENT_LOG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateEventLogFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > EVENT_LOG_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(EVENT_LOG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidEventLogFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (/\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'Compressed event logs are not supported — decompress first' });
      continue;
    }
    if (!isSupportedEventLogFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xes, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateEventLogFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleEventLogFile(): File {
  return new File([EVENT_LOG_CSV_SAMPLE], 'sample-ticket-log.csv', { type: 'text/csv', lastModified: 0 });
}

export function createEventLogFileRecord(file: File, bytes: Uint8Array): EventLogLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: EventLogDataset | null = null;
  let softFail = false;
  try {
    parsed = parseEventLogBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.cases.length && !parsed.events.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse event log');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportEventLog(file: EventLogLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function formatEventLogDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

export function buildEventLogMetadataRows(dataset: EventLogDataset): EventLogMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Cases', value: String(dataset.cases.length) },
    { key: 'Events', value: String(dataset.events.length) },
    { key: 'Activities', value: String(dataset.activities.length) },
    { key: 'Top activity', value: dataset.activities[0] ? `${dataset.activities[0].name} (${dataset.activities[0].frequency})` : '—' }
  ];
}

export function buildEventLogCaseMetadata(item: EventLogCase): EventLogMetadataRow[] {
  return [
    { key: 'Case', value: item.caseId },
    { key: 'Events', value: String(item.events) },
    { key: 'Duration', value: formatEventLogDuration(item.durationMs) },
    { key: 'Resources', value: item.resources.join(', ') || '—' },
    { key: 'Path', value: item.pathLabel }
  ];
}

export function buildEventLogActivityMetadata(activity: EventLogActivity): EventLogMetadataRow[] {
  return [
    { key: 'Name', value: activity.name },
    { key: 'Frequency', value: String(activity.frequency) },
    { key: 'Cases', value: `${activity.cases} (${activity.pct}%)` },
    { key: 'Resources', value: activity.resources.join(', ') || '—' }
  ];
}

export function buildEventLogEventMetadata(event: EventLogEvent): EventLogMetadataRow[] {
  return [
    { key: 'Case', value: event.caseId },
    { key: 'Activity', value: event.activity },
    { key: 'Time', value: event.timestamp || '—' },
    { key: 'Resource', value: event.resource || '—' },
    { key: 'Lifecycle', value: event.lifecycle || '—' }
  ];
}

export function exportEventLogSummaryJson(file: EventLogLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed event log');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      cases: parsed.cases.map((c) => ({ caseId: c.caseId, events: c.events, durationMs: c.durationMs, path: c.activities })),
      activities: parsed.activities.map((a) => ({ name: a.name, frequency: a.frequency, cases: a.cases })),
      events: parsed.events.map((e) => ({ caseId: e.caseId, activity: e.activity, timestamp: e.timestamp, resource: e.resource }))
    },
    null,
    2
  );
}

export function exportEventLogCasesCsv(dataset: EventLogDataset): string {
  const lines = ['index,case,events,duration_ms,path'];
  for (const c of dataset.cases) {
    lines.push([c.index + 1, csv(c.caseId), c.events, c.durationMs, csv(c.pathLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportEventLogEventsCsv(dataset: EventLogDataset): string {
  const lines = ['index,case,activity,timestamp,resource,lifecycle'];
  for (const e of dataset.events) {
    lines.push([e.index + 1, csv(e.caseId), csv(e.activity), csv(e.timestamp), csv(e.resource), csv(e.lifecycle)].join(','));
  }
  return lines.join('\n');
}

export function resolveEventLogSuggestion(state: { hasFiles: boolean; hasError: boolean }): EventLogSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the support ticket event log',
      reason: 'Load a local CSV log with cases, activities, timestamps, and resources.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an event log',
      reason: 'Drop XES, XML, JSON, or CSV — or load the sample support ticket log.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
