import { TRACE_EXPLORER_XES_SAMPLE } from '../constants/trace-explorer-sample.data';
import { TRACE_EXPLORER_MAX_FILE_BYTES, TRACE_EXPLORER_SUPPORTED_EXTENSIONS } from '../constants/trace-explorer.constants';
import type {
  TraceAttributeStat,
  TraceCase,
  TraceExplorerDataset,
  TraceExplorerLoadedFile,
  TraceExplorerMetadataRow,
  TraceExplorerSuggestion,
  TraceStep
} from '../types/trace-explorer.types';
import { parseTraceExplorerBytes } from './trace-explorer-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatTraceExplorerFileSize,
  readFileBytes as readTraceExplorerFileBytes
} from './process-file.utils';

export {
  filterTraceAttributes,
  filterTraceCases,
  filterTraceSteps,
  parseTraceExplorerBytes,
  parseTraceExplorerText
} from './trace-explorer-parse.utils';
export { renderTraceAttributes, renderTracePaths, renderTraceSteps, traceExplorerColor } from './trace-explorer-render.utils';

export function isSupportedTraceExplorerFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TRACE_EXPLORER_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateTraceExplorerFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TRACE_EXPLORER_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(TRACE_EXPLORER_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTraceExplorerFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed trace files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTraceExplorerFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xes, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateTraceExplorerFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTraceExplorerFile(): File {
  return new File([TRACE_EXPLORER_XES_SAMPLE], 'sample-claim-traces.xes', { type: 'application/xml', lastModified: 0 });
}

export function createTraceExplorerFileRecord(file: File, bytes: Uint8Array): TraceExplorerLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TraceExplorerDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTraceExplorerBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.traces.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse traces');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTraceExplorer(file: TraceExplorerLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function formatTraceDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

export function buildTraceExplorerMetadataRows(dataset: TraceExplorerDataset): TraceExplorerMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Traces', value: String(dataset.traces.length) },
    { key: 'Steps', value: String(dataset.steps.length) },
    { key: 'Attributes', value: String(dataset.attributes.length) },
    { key: 'Top attr', value: dataset.attributes[0] ? `${dataset.attributes[0].key} (${dataset.attributes[0].distinct})` : '—' }
  ];
}

export function buildTraceCaseMetadata(trace: TraceCase): TraceExplorerMetadataRow[] {
  return [
    { key: 'Case', value: trace.caseId },
    { key: 'Steps', value: String(trace.events) },
    { key: 'Duration', value: formatTraceDuration(trace.durationMs) },
    { key: 'Path', value: trace.pathLabel },
    ...trace.attributes.map((a) => ({ key: a.key, value: a.value }))
  ];
}

export function buildTraceAttributeMetadata(stat: TraceAttributeStat): TraceExplorerMetadataRow[] {
  return [
    { key: 'Attribute', value: stat.key },
    { key: 'Distinct', value: String(stat.distinct) },
    ...stat.values.slice(0, 6).map((v) => ({ key: v.value, value: `${v.count} (${v.pct}%)` }))
  ];
}

export function buildTraceStepMetadata(step: TraceStep): TraceExplorerMetadataRow[] {
  return [
    { key: 'Case', value: step.caseId },
    { key: 'Step', value: String(step.step) },
    { key: 'Activity', value: step.activity },
    { key: 'Resource', value: step.resource || '—' },
    { key: 'Time', value: step.timestamp || '—' },
    { key: 'Duration', value: formatTraceDuration(step.durationMs) }
  ];
}

export function exportTraceExplorerSummaryJson(file: TraceExplorerLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed traces');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      traces: parsed.traces.map((t) => ({
        caseId: t.caseId,
        events: t.events,
        durationMs: t.durationMs,
        path: t.path,
        attributes: Object.fromEntries(t.attributes.map((a) => [a.key, a.value]))
      })),
      attributes: parsed.attributes.map((a) => ({ key: a.key, values: a.values }))
    },
    null,
    2
  );
}

export function exportTraceExplorerTracesCsv(dataset: TraceExplorerDataset): string {
  const attrKeys = dataset.attributes.map((a) => a.key);
  const lines = [`index,case,events,duration_ms,path${attrKeys.length ? `,${attrKeys.join(',')}` : ''}`];
  for (const t of dataset.traces) {
    const attrs = attrKeys.map((key) => csv(t.attributes.find((a) => a.key === key)?.value || ''));
    lines.push([t.index + 1, csv(t.caseId), t.events, t.durationMs, csv(t.pathLabel), ...attrs].join(','));
  }
  return lines.join('\n');
}

export function exportTraceExplorerStepsCsv(dataset: TraceExplorerDataset): string {
  const lines = ['index,case,step,activity,timestamp,resource,duration_ms'];
  for (const s of dataset.steps) {
    lines.push([s.index + 1, csv(s.caseId), s.step, csv(s.activity), csv(s.timestamp), csv(s.resource), s.durationMs].join(','));
  }
  return lines.join('\n');
}

export function resolveTraceExplorerSuggestion(state: { hasFiles: boolean; hasError: boolean }): TraceExplorerSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the insurance claim traces',
      reason: 'Load a local XES log with paths, channel, priority, and amount attributes.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open case traces',
      reason: 'Drop XES, XML, JSON, or CSV — or load the sample claim traces.',
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
