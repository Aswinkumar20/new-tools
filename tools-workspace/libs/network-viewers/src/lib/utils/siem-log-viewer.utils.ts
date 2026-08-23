import { SIEM_JSON_SAMPLE } from '../constants/siem-sample.data';
import { SIEM_MAX_FILE_BYTES, SIEM_SUPPORTED_EXTENSIONS } from '../constants/siem-log-viewer.constants';
import type {
  SiemCorrelation,
  SiemDataset,
  SiemEvent,
  SiemLoadedFile,
  SiemMetadataRow,
  SiemSuggestion
} from '../types/siem-log-viewer.types';
import { parseSiemBytes } from './siem-log-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatSiemFileSize,
  readFileBytes as readSiemFileBytes
} from './network-file.utils';

export { filterSiemCorrelations, filterSiemEvents, parseSiemBytes, parseSiemText } from './siem-log-parse.utils';
export { renderSiemCorrelations, renderSiemSeverity, renderSiemTimeline, severityColor } from './siem-log-render.utils';

export function isSupportedSiemFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SIEM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateSiemFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SIEM_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(SIEM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSiemFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SIEM exports are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSiemFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .csv, .cef, or .log)' });
      continue;
    }
    const sizeError = validateSiemFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSiemFile(): File {
  return new File([SIEM_JSON_SAMPLE], 'sample-siem-export.json', { type: 'application/json', lastModified: 0 });
}

export function createSiemFileRecord(file: File, bytes: Uint8Array): SiemLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SiemDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSiemBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.events.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SIEM export');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSiem(file: SiemLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSiemMetadataRows(dataset: SiemDataset): SiemMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Events', value: String(dataset.events.length) },
    { key: 'Correlations', value: String(dataset.correlations.length) },
    { key: 'Severities', value: dataset.severities.map((s) => `${s.name} ${s.count}`).join(', ') || '—' },
    { key: 'Span', value: `${Math.round(dataset.durationMs)} ms` }
  ];
}

export function buildSiemEventMetadata(event: SiemEvent): SiemMetadataRow[] {
  return [
    { key: 'Time', value: event.time },
    { key: 'Severity', value: event.severity },
    { key: 'Rule', value: event.rule },
    { key: 'Rule ID', value: event.ruleId || '—' },
    { key: 'Host', value: event.host || '—' },
    { key: 'User', value: event.user || '—' },
    { key: 'Source', value: event.src || '—' },
    { key: 'Destination', value: event.dst || '—' },
    { key: 'Tactic', value: event.tactic || '—' },
    { key: 'Technique', value: event.technique || '—' },
    { key: 'Count', value: String(event.count) },
    { key: 'Message', value: event.message || '—' }
  ];
}

export function buildCorrelationMetadata(corr: SiemCorrelation): SiemMetadataRow[] {
  return [
    { key: 'Cluster', value: corr.label },
    { key: 'Severity', value: corr.severity },
    { key: 'Events', value: String(corr.events) },
    { key: 'Hosts', value: corr.hosts.join(', ') || '—' },
    { key: 'Sources', value: corr.srcs.join(', ') || '—' },
    { key: 'Rules', value: corr.rules.join(', ') || '—' }
  ];
}

export function exportSiemSummaryJson(file: SiemLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SIEM export');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      severities: parsed.severities,
      correlations: parsed.correlations,
      events: parsed.events.map((e) => ({
        time: e.time,
        severity: e.severity,
        rule: e.rule,
        host: e.host,
        src: e.src,
        technique: e.technique
      }))
    },
    null,
    2
  );
}

export function exportSiemEventsCsv(dataset: SiemDataset): string {
  const lines = ['index,time,severity,rule,rule_id,host,user,src,dst,tactic,technique,count'];
  for (const e of dataset.events) {
    lines.push(
      [
        e.index + 1,
        csv(e.time),
        e.severity,
        csv(e.rule),
        csv(e.ruleId),
        csv(e.host),
        csv(e.user),
        csv(e.src),
        csv(e.dst),
        csv(e.tactic),
        csv(e.technique),
        e.count
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportSiemCorrelationsCsv(dataset: SiemDataset): string {
  const lines = ['label,severity,events,hosts,srcs'];
  for (const c of dataset.correlations) {
    lines.push([csv(c.label), c.severity, c.events, csv(c.hosts.join('|')), csv(c.srcs.join('|'))].join(','));
  }
  return lines.join('\n');
}

export function resolveSiemSuggestion(state: { hasFiles: boolean; hasError: boolean }): SiemSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the SOC SIEM sample',
      reason: 'Load a local export with brute-force, C2 beacon, and VPN events to correlate.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SIEM export',
      reason: 'Drop JSON, CSV, or CEF — or load the sample SOC morning export.',
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
