import { PROCESS_MAP_JSON_SAMPLE } from '../constants/process-map-sample.data';
import { PROCESS_MAP_MAX_FILE_BYTES, PROCESS_MAP_SUPPORTED_EXTENSIONS } from '../constants/process-map-viewer.constants';
import type {
  ProcessMapActivity,
  ProcessMapDataset,
  ProcessMapFlow,
  ProcessMapLoadedFile,
  ProcessMapMetadataRow,
  ProcessMapSuggestion,
  ProcessMapVariant
} from '../types/process-map-viewer.types';
import { parseProcessMapBytes } from './process-map-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatProcessMapFileSize,
  readFileBytes as readProcessMapFileBytes
} from './process-file.utils';

export {
  filterProcessMapActivities,
  filterProcessMapFlows,
  filterProcessMapVariants,
  parseProcessMapBytes,
  parseProcessMapText
} from './process-map-parse.utils';
export {
  processMapFrequencyColor,
  processMapVariantColor,
  renderProcessMapFlows,
  renderProcessMapFrequencies,
  renderProcessMapVariants
} from './process-map-render.utils';

export function isSupportedProcessMapFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PROCESS_MAP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateProcessMapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PROCESS_MAP_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(PROCESS_MAP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidProcessMapFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed process maps are not supported — decompress first' });
      continue;
    }
    if (!isSupportedProcessMapFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .xml, or .csv)' });
      continue;
    }
    const sizeError = validateProcessMapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleProcessMapFile(): File {
  return new File([PROCESS_MAP_JSON_SAMPLE], 'sample-order-process-map.json', { type: 'application/json', lastModified: 0 });
}

export function createProcessMapFileRecord(file: File, bytes: Uint8Array): ProcessMapLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ProcessMapDataset | null = null;
  let softFail = false;
  try {
    parsed = parseProcessMapBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.activities.length && !parsed.variants.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse process map');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportProcessMap(file: ProcessMapLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function formatProcessMapDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

export function buildProcessMapMetadataRows(dataset: ProcessMapDataset): ProcessMapMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Cases', value: String(dataset.cases) },
    { key: 'Activities', value: String(dataset.activities.length) },
    { key: 'Flows', value: String(dataset.flows.length) },
    { key: 'Variants', value: String(dataset.variants.length) },
    { key: 'Top variant', value: dataset.variants[0] ? `${dataset.variants[0].name} (${dataset.variants[0].pct}%)` : '—' }
  ];
}

export function buildProcessMapActivityMetadata(activity: ProcessMapActivity): ProcessMapMetadataRow[] {
  return [
    { key: 'Name', value: activity.name },
    { key: 'Frequency', value: String(activity.frequency) },
    { key: 'Share', value: `${activity.pct}%` },
    { key: 'Avg duration', value: formatProcessMapDuration(activity.avgDurationMs) }
  ];
}

export function buildProcessMapVariantMetadata(variant: ProcessMapVariant): ProcessMapMetadataRow[] {
  return [
    { key: 'Name', value: variant.name },
    { key: 'Cases', value: String(variant.cases) },
    { key: 'Share', value: `${variant.pct}%` },
    { key: 'Steps', value: String(variant.path.length) },
    { key: 'Path', value: variant.pathLabel }
  ];
}

export function buildProcessMapFlowMetadata(flow: ProcessMapFlow): ProcessMapMetadataRow[] {
  return [
    { key: 'From', value: flow.sourceName },
    { key: 'To', value: flow.targetName },
    { key: 'Frequency', value: String(flow.frequency) },
    { key: 'Share', value: `${flow.pct}%` }
  ];
}

export function exportProcessMapSummaryJson(file: ProcessMapLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed process map');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      cases: parsed.cases,
      activities: parsed.activities.map((a) => ({ name: a.name, frequency: a.frequency, pct: a.pct })),
      flows: parsed.flows.map((f) => ({ source: f.sourceName, target: f.targetName, frequency: f.frequency })),
      variants: parsed.variants.map((v) => ({ name: v.name, cases: v.cases, pct: v.pct, path: v.path }))
    },
    null,
    2
  );
}

export function exportProcessMapVariantsCsv(dataset: ProcessMapDataset): string {
  const lines = ['index,name,cases,pct,path'];
  for (const v of dataset.variants) {
    lines.push([v.index + 1, csv(v.name), v.cases, v.pct, csv(v.pathLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportProcessMapFlowsCsv(dataset: ProcessMapDataset): string {
  const lines = ['index,source,target,frequency,pct'];
  for (const f of dataset.flows) {
    lines.push([f.index + 1, csv(f.sourceName), csv(f.targetName), f.frequency, f.pct].join(','));
  }
  return lines.join('\n');
}

export function resolveProcessMapSuggestion(state: { hasFiles: boolean; hasError: boolean }): ProcessMapSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order fulfillment process map',
      reason: 'Load a local discovered map with happy-path, reject, and invoice-before-ship variants.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a process map',
      reason: 'Drop JSON, XML, or CSV — or load the sample order fulfillment map.',
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
