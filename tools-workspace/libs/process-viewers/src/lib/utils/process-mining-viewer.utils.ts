import { PROCESS_MINING_XES_SAMPLE } from '../constants/process-mining-sample.data';
import { PROCESS_MINING_MAX_FILE_BYTES, PROCESS_MINING_SUPPORTED_EXTENSIONS } from '../constants/process-mining-viewer.constants';
import type {
  ProcessMiningActivity,
  ProcessMiningDataset,
  ProcessMiningDfgEdge,
  ProcessMiningLoadedFile,
  ProcessMiningMetadataRow,
  ProcessMiningSuggestion,
  ProcessMiningVariant
} from '../types/process-mining-viewer.types';
import { parseProcessMiningBytes } from './process-mining-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatProcessMiningFileSize,
  readFileBytes as readProcessMiningFileBytes
} from './process-file.utils';

export {
  filterProcessMiningActivities,
  filterProcessMiningDfg,
  filterProcessMiningVariants,
  parseProcessMiningBytes,
  parseProcessMiningText
} from './process-mining-parse.utils';
export {
  processMiningFrequencyColor,
  processMiningVariantColor,
  renderProcessMiningActivities,
  renderProcessMiningDfg,
  renderProcessMiningVariants
} from './process-mining-render.utils';

export function isSupportedProcessMiningFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PROCESS_MINING_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateProcessMiningFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PROCESS_MINING_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(PROCESS_MINING_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidProcessMiningFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed mining files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedProcessMiningFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xes, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateProcessMiningFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleProcessMiningFile(): File {
  return new File([PROCESS_MINING_XES_SAMPLE], 'sample-order-mining.xes', { type: 'application/xml', lastModified: 0 });
}

export function createProcessMiningFileRecord(file: File, bytes: Uint8Array): ProcessMiningLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ProcessMiningDataset | null = null;
  let softFail = false;
  try {
    parsed = parseProcessMiningBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.variants.length && !parsed.dfg.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse process mining file');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportProcessMining(file: ProcessMiningLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function formatProcessMiningDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}

export function buildProcessMiningMetadataRows(dataset: ProcessMiningDataset): ProcessMiningMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Cases', value: String(dataset.cases) },
    { key: 'Events', value: String(dataset.events) },
    { key: 'Variants', value: String(dataset.variants.length) },
    { key: 'DFG edges', value: String(dataset.dfg.length) },
    { key: 'Top variant', value: dataset.variants[0] ? `${dataset.variants[0].name} (${dataset.variants[0].pct}%)` : '—' }
  ];
}

export function buildProcessMiningVariantMetadata(variant: ProcessMiningVariant): ProcessMiningMetadataRow[] {
  return [
    { key: 'Name', value: variant.name },
    { key: 'Cases', value: String(variant.cases) },
    { key: 'Share', value: `${variant.pct}%` },
    { key: 'Steps', value: String(variant.path.length) },
    { key: 'Path', value: variant.pathLabel }
  ];
}

export function buildProcessMiningActivityMetadata(activity: ProcessMiningActivity): ProcessMiningMetadataRow[] {
  return [
    { key: 'Name', value: activity.name },
    { key: 'Frequency', value: String(activity.frequency) },
    { key: 'Share', value: `${activity.pct}%` },
    { key: 'Starts', value: String(activity.startCount) },
    { key: 'Ends', value: String(activity.endCount) }
  ];
}

export function buildProcessMiningDfgMetadata(edge: ProcessMiningDfgEdge): ProcessMiningMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName },
    { key: 'To', value: edge.targetName },
    { key: 'Frequency', value: String(edge.frequency) },
    { key: 'Share', value: `${edge.pct}%` }
  ];
}

export function exportProcessMiningSummaryJson(file: ProcessMiningLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed process mining result');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      cases: parsed.cases,
      events: parsed.events,
      variants: parsed.variants.map((v) => ({ name: v.name, cases: v.cases, pct: v.pct, path: v.path })),
      dfg: parsed.dfg.map((e) => ({ source: e.sourceName, target: e.targetName, frequency: e.frequency })),
      activities: parsed.activities.map((a) => ({ name: a.name, frequency: a.frequency, pct: a.pct }))
    },
    null,
    2
  );
}

export function exportProcessMiningVariantsCsv(dataset: ProcessMiningDataset): string {
  const lines = ['index,name,cases,pct,path'];
  for (const v of dataset.variants) {
    lines.push([v.index + 1, csv(v.name), v.cases, v.pct, csv(v.pathLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportProcessMiningDfgCsv(dataset: ProcessMiningDataset): string {
  const lines = ['index,source,target,frequency,pct'];
  for (const e of dataset.dfg) {
    lines.push([e.index + 1, csv(e.sourceName), csv(e.targetName), e.frequency, e.pct].join(','));
  }
  return lines.join('\n');
}

export function resolveProcessMiningSuggestion(state: { hasFiles: boolean; hasError: boolean }): ProcessMiningSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order fulfillment mining sample',
      reason: 'Load a local XES log with happy-path, reject, and invoice-before-ship variants.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an event log or mined map',
      reason: 'Drop XES, XML, JSON, or CSV — or load the sample order fulfillment log.',
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
