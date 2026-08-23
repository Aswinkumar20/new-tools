import { SYSLOG_LOG_SAMPLE } from '../constants/syslog-sample.data';
import { SYSLOG_MAX_FILE_BYTES, SYSLOG_SUPPORTED_EXTENSIONS } from '../constants/syslog-viewer.constants';
import type {
  SyslogDataset,
  SyslogLoadedFile,
  SyslogMessage,
  SyslogMetadataRow,
  SyslogSuggestion
} from '../types/syslog-viewer.types';
import { parseSyslogBytes } from './syslog-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatSyslogFileSize,
  readFileBytes as readSyslogFileBytes
} from './network-file.utils';

export { filterSyslogMessages, parseSyslogBytes, parseSyslogText } from './syslog-parse.utils';
export { renderSyslogFacilities, renderSyslogSeverity, syslogFacilityColor, syslogSeverityColor } from './syslog-render.utils';

export function isSupportedSyslogFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SYSLOG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateSyslogFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SYSLOG_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(SYSLOG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSyslogFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed syslog dumps are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSyslogFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .log, .csv, or .json)' });
      continue;
    }
    const sizeError = validateSyslogFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSyslogFile(): File {
  return new File([SYSLOG_LOG_SAMPLE], 'sample-edge-syslog.log', { type: 'text/plain', lastModified: 0 });
}

export function createSyslogFileRecord(file: File, bytes: Uint8Array): SyslogLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SyslogDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSyslogBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.messages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse syslog dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSyslog(file: SyslogLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSyslogMetadataRows(dataset: SyslogDataset): SyslogMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Messages', value: String(dataset.messages.length) },
    { key: 'Facilities', value: dataset.facilities.map((f) => `${f.name} ${f.count}`).join(', ') || '—' },
    { key: 'Severities', value: dataset.severities.map((s) => `${s.name} ${s.count}`).join(', ') || '—' },
    { key: 'Span', value: `${Math.round(dataset.durationMs)} ms` }
  ];
}

export function buildSyslogMessageMetadata(message: SyslogMessage): SyslogMetadataRow[] {
  return [
    { key: 'Time', value: message.time },
    { key: 'Facility', value: message.facility },
    { key: 'Severity', value: message.severity },
    { key: 'PRI', value: message.pri == null ? '—' : String(message.pri) },
    { key: 'Host', value: message.host || '—' },
    { key: 'App', value: message.app || '—' },
    { key: 'PID', value: message.pid || '—' },
    { key: 'Message', value: message.message || '—' }
  ];
}

export function exportSyslogSummaryJson(file: SyslogLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed syslog dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      facilities: parsed.facilities,
      severities: parsed.severities,
      messages: parsed.messages.map((m) => ({
        time: m.time,
        facility: m.facility,
        severity: m.severity,
        host: m.host,
        app: m.app,
        message: m.message
      }))
    },
    null,
    2
  );
}

export function exportSyslogMessagesCsv(dataset: SyslogDataset): string {
  const lines = ['index,time,facility,severity,pri,host,app,pid,message'];
  for (const m of dataset.messages) {
    lines.push(
      [m.index + 1, csv(m.time), m.facility, m.severity, m.pri ?? '', csv(m.host), csv(m.app), csv(m.pid), csv(m.message)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportSyslogFacilitiesCsv(dataset: SyslogDataset): string {
  const lines = ['facility,count'];
  for (const f of dataset.facilities) lines.push([f.name, f.count].join(','));
  return lines.join('\n');
}

export function resolveSyslogSuggestion(state: { hasFiles: boolean; hasError: boolean }): SyslogSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the edge syslog sample',
      reason: 'Load a local RFC 3164/5424 dump with auth, daemon, and kernel messages.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a syslog dump',
      reason: 'Drop a .log, .csv, or JSON export — or load the sample edge gateway syslog.',
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
