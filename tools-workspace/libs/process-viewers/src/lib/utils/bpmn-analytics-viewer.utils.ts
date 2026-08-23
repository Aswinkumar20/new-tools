import { BPMN_ANALYTICS_JSON_SAMPLE } from '../constants/bpmn-analytics-sample.data';
import {
  BPMN_ANALYTICS_MAX_FILE_BYTES,
  BPMN_ANALYTICS_SUPPORTED_EXTENSIONS
} from '../constants/bpmn-analytics-viewer.constants';
import type {
  BpmnAnalyticsActivity,
  BpmnAnalyticsDataset,
  BpmnAnalyticsLoadedFile,
  BpmnAnalyticsMetadataRow,
  BpmnAnalyticsSuggestion
} from '../types/bpmn-analytics-viewer.types';
import { parseBpmnAnalyticsBytes } from './bpmn-analytics-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatBpmnAnalyticsFileSize,
  readFileBytes as readBpmnAnalyticsFileBytes
} from './process-file.utils';

export { filterBpmnAnalyticsActivities, parseBpmnAnalyticsBytes, parseBpmnAnalyticsText } from './bpmn-analytics-parse.utils';
export {
  bpmnAnalyticsSeverityColor,
  formatDurationMs,
  renderBpmnAnalyticsOverlays,
  renderBpmnAnalyticsSeverities
} from './bpmn-analytics-render.utils';

export function isSupportedBpmnAnalyticsFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (BPMN_ANALYTICS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateBpmnAnalyticsFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > BPMN_ANALYTICS_MAX_FILE_BYTES) {
    return `File is too large (max ${formatProcessFileSize(BPMN_ANALYTICS_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidBpmnAnalyticsFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed analytics files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedBpmnAnalyticsFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .bpmn, .xml, or .csv)' });
      continue;
    }
    const sizeError = validateBpmnAnalyticsFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleBpmnAnalyticsFile(): File {
  return new File([BPMN_ANALYTICS_JSON_SAMPLE], 'sample-order-analytics.json', { type: 'application/json', lastModified: 0 });
}

export function createBpmnAnalyticsFileRecord(file: File, bytes: Uint8Array): BpmnAnalyticsLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: BpmnAnalyticsDataset | null = null;
  let softFail = false;
  try {
    parsed = parseBpmnAnalyticsBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.activities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse BPMN analytics');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportBpmnAnalytics(file: BpmnAnalyticsLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildBpmnAnalyticsMetadataRows(dataset: BpmnAnalyticsDataset): BpmnAnalyticsMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Process', value: dataset.processName || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Cases', value: dataset.cases ? String(dataset.cases) : '—' },
    { key: 'Activities', value: String(dataset.activities.length) },
    { key: 'Flows', value: String(dataset.flows.length) },
    { key: 'Severities', value: dataset.severities.map((s) => `${s.name} ${s.count}`).join(', ') || '—' }
  ];
}

export function buildBpmnAnalyticsActivityMetadata(activity: BpmnAnalyticsActivity): BpmnAnalyticsMetadataRow[] {
  return [
    { key: 'ID', value: activity.id },
    { key: 'Name', value: activity.name },
    { key: 'Kind', value: activity.kind },
    { key: 'Severity', value: activity.severity },
    { key: 'Frequency', value: String(activity.frequency) },
    { key: 'Avg duration', value: formatMs(activity.avgDurationMs) },
    { key: 'Wait', value: formatMs(activity.waitMs) },
    { key: 'Failures', value: String(activity.failures) },
    { key: 'Score', value: String(activity.bottleneckScore) }
  ];
}

export function exportBpmnAnalyticsSummaryJson(file: BpmnAnalyticsLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed BPMN analytics');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      process: parsed.processName,
      sourceKind: parsed.sourceKind,
      cases: parsed.cases,
      severities: parsed.severities,
      activities: parsed.activities.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        frequency: a.frequency,
        avgDurationMs: a.avgDurationMs,
        waitMs: a.waitMs,
        failures: a.failures,
        bottleneckScore: a.bottleneckScore,
        severity: a.severity
      })),
      flows: parsed.flows
    },
    null,
    2
  );
}

export function exportBpmnAnalyticsActivitiesCsv(dataset: BpmnAnalyticsDataset): string {
  const lines = ['index,id,name,kind,severity,frequency,avg_duration_ms,wait_ms,failures,score'];
  for (const a of dataset.activities) {
    lines.push(
      [a.index + 1, csv(a.id), csv(a.name), a.kind, a.severity, a.frequency, a.avgDurationMs, a.waitMs, a.failures, a.bottleneckScore].join(',')
    );
  }
  return lines.join('\n');
}

export function exportBpmnAnalyticsBottlenecksCsv(dataset: BpmnAnalyticsDataset): string {
  const lines = ['rank,id,name,severity,wait_ms,frequency,score'];
  const bottlenecks = dataset.activities.filter((a) => a.severity === 'critical' || a.severity === 'high' || a.severity === 'medium');
  bottlenecks.forEach((a, i) => {
    lines.push([i + 1, csv(a.id), csv(a.name), a.severity, a.waitMs, a.frequency, a.bottleneckScore].join(','));
  });
  return lines.join('\n');
}

export function resolveBpmnAnalyticsSuggestion(state: { hasFiles: boolean; hasError: boolean }): BpmnAnalyticsSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order analytics sample',
      reason: 'Load a local BPMN analytics snapshot with wait-time bottlenecks and overlays.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open BPMN analytics',
      reason: 'Drop JSON metrics, CSV, or a .bpmn diagram — or load the sample order process.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = sec / 60;
  if (min < 60) return `${min.toFixed(1)}m`;
  return `${(min / 60).toFixed(1)}h`;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
