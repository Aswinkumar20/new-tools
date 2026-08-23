import { PROCESS_TIMELINE_CSV_SAMPLE } from '../constants/process-timeline-sample.data';
import { PROCESS_TIMELINE_MAX_FILE_BYTES, PROCESS_TIMELINE_SUPPORTED_EXTENSIONS } from '../constants/process-timeline-viewer.constants';
import type {
  ProcessTimelineDataset,
  ProcessTimelineItem,
  ProcessTimelineLane,
  ProcessTimelineLoadedFile,
  ProcessTimelineMetadataRow,
  ProcessTimelineSuggestion
} from '../types/process-timeline-viewer.types';
import { parseProcessTimelineBytes } from './process-timeline-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatProcessTimelineFileSize,
  readFileBytes as readProcessTimelineFileBytes
} from './process-file.utils';

export {
  filterTimelineItems,
  filterTimelineLanes,
  parseProcessTimelineBytes,
  parseProcessTimelineText
} from './process-timeline-parse.utils';
export {
  processTimelineColor,
  renderTimelineEvents,
  renderTimelineGantt,
  renderTimelineLanes
} from './process-timeline-render.utils';

export function isSupportedProcessTimelineFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PROCESS_TIMELINE_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateProcessTimelineFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PROCESS_TIMELINE_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(PROCESS_TIMELINE_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidProcessTimelineFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed timeline files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedProcessTimelineFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xes, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateProcessTimelineFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleProcessTimelineFile(): File {
  return new File([PROCESS_TIMELINE_CSV_SAMPLE], 'sample-warehouse-timeline.csv', { type: 'text/csv', lastModified: 0 });
}

export function createProcessTimelineFileRecord(file: File, bytes: Uint8Array): ProcessTimelineLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ProcessTimelineDataset | null = null;
  let softFail = false;
  try {
    parsed = parseProcessTimelineBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.items.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse timeline');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportProcessTimeline(file: ProcessTimelineLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function formatTimelineDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

export function buildProcessTimelineMetadataRows(dataset: ProcessTimelineDataset): ProcessTimelineMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Events', value: String(dataset.items.length) },
    { key: 'Case lanes', value: String(dataset.caseLanes.length) },
    { key: 'Resource lanes', value: String(dataset.resourceLanes.length) },
    { key: 'Span', value: formatTimelineDuration(Math.max(0, dataset.endMs - dataset.startMs)) }
  ];
}

export function buildTimelineItemMetadata(item: ProcessTimelineItem): ProcessTimelineMetadataRow[] {
  return [
    { key: 'Case', value: item.caseId },
    { key: 'Activity', value: item.activity },
    { key: 'Resource', value: item.resource },
    { key: 'Start', value: item.startTime || '—' },
    { key: 'End', value: item.endTime || '—' },
    { key: 'Duration', value: formatTimelineDuration(item.durationMs) }
  ];
}

export function buildTimelineLaneMetadata(lane: ProcessTimelineLane): ProcessTimelineMetadataRow[] {
  return [
    { key: 'Lane', value: lane.name },
    { key: 'Kind', value: lane.kind },
    { key: 'Events', value: String(lane.events) },
    { key: 'Span', value: formatTimelineDuration(lane.durationMs) }
  ];
}

export function exportProcessTimelineSummaryJson(file: ProcessTimelineLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed timeline');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      startMs: parsed.startMs,
      endMs: parsed.endMs,
      items: parsed.items.map((it) => ({
        caseId: it.caseId,
        activity: it.activity,
        resource: it.resource,
        start: it.startTime,
        end: it.endTime,
        durationMs: it.durationMs
      })),
      caseLanes: parsed.caseLanes.map((l) => ({ name: l.name, events: l.events })),
      resourceLanes: parsed.resourceLanes.map((l) => ({ name: l.name, events: l.events }))
    },
    null,
    2
  );
}

export function exportProcessTimelineCsv(dataset: ProcessTimelineDataset): string {
  const lines = ['index,case,activity,resource,start,end,duration_ms'];
  for (const it of dataset.items) {
    lines.push([it.index + 1, csv(it.caseId), csv(it.activity), csv(it.resource), csv(it.startTime), csv(it.endTime), it.durationMs].join(','));
  }
  return lines.join('\n');
}

export function exportProcessTimelineLanesCsv(dataset: ProcessTimelineDataset): string {
  const lines = ['index,kind,name,events,duration_ms'];
  for (const lane of [...dataset.caseLanes, ...dataset.resourceLanes]) {
    lines.push([lane.index + 1, lane.kind, csv(lane.name), lane.events, lane.durationMs].join(','));
  }
  return lines.join('\n');
}

export function resolveProcessTimelineSuggestion(state: { hasFiles: boolean; hasError: boolean }): ProcessTimelineSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the warehouse timeline sample',
      reason: 'Load a local CSV log with overlapping cases and resource lanes.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a process timeline',
      reason: 'Drop XES, XML, JSON, or CSV — or load the sample warehouse timeline.',
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
