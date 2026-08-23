import { FIREWALL_LOG_SAMPLE } from '../constants/firewall-sample.data';
import { FIREWALL_MAX_FILE_BYTES, FIREWALL_SUPPORTED_EXTENSIONS } from '../constants/firewall-log-viewer.constants';
import type {
  FirewallDataset,
  FirewallEvent,
  FirewallLoadedFile,
  FirewallMetadataRow,
  FirewallSuggestion
} from '../types/firewall-log-viewer.types';
import { parseFirewallBytes } from './firewall-log-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatFirewallFileSize,
  readFileBytes as readFirewallFileBytes
} from './network-file.utils';

export { filterFirewallEvents, parseFirewallBytes, parseFirewallText } from './firewall-log-parse.utils';
export { actionColor, renderFirewallActions, renderFirewallTimeline } from './firewall-log-render.utils';

export function isSupportedFirewallFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FIREWALL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateFirewallFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FIREWALL_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(FIREWALL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFirewallFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed firewall logs are not supported — decompress first' });
      continue;
    }
    if (!isSupportedFirewallFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .log, .csv, or .json)' });
      continue;
    }
    const sizeError = validateFirewallFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFirewallFile(): File {
  return new File([FIREWALL_LOG_SAMPLE], 'sample-edge-fw.log', { type: 'text/plain', lastModified: 0 });
}

export function createFirewallFileRecord(file: File, bytes: Uint8Array): FirewallLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FirewallDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFirewallBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.events.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse firewall log');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFirewall(file: FirewallLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFirewallMetadataRows(dataset: FirewallDataset): FirewallMetadataRow[] {
  const denies = dataset.events.filter((e) => e.action === 'deny' || e.action === 'drop' || e.action === 'reject').length;
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Events', value: String(dataset.events.length) },
    { key: 'Actions', value: dataset.actions.map((a) => `${a.name} ${a.count}`).join(', ') || '—' },
    { key: 'Blocked', value: String(denies) },
    { key: 'Span', value: `${Math.round(dataset.durationMs)} ms` }
  ];
}

export function buildFirewallEventMetadata(event: FirewallEvent): FirewallMetadataRow[] {
  return [
    { key: 'Time', value: event.time },
    { key: 'Action', value: event.action },
    { key: 'Source', value: event.srcPort != null ? `${event.src}:${event.srcPort}` : event.src || '—' },
    { key: 'Destination', value: event.dstPort != null ? `${event.dst}:${event.dstPort}` : event.dst || '—' },
    { key: 'Protocol', value: event.protocol },
    { key: 'Rule', value: event.rule || '—' },
    { key: 'Interface', value: event.iface || '—' },
    { key: 'Message', value: event.message || '—' }
  ];
}

export function exportFirewallSummaryJson(file: FirewallLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed firewall log');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      actions: parsed.actions,
      events: parsed.events.map((e) => ({
        time: e.time,
        action: e.action,
        src: e.src,
        dst: e.dst,
        protocol: e.protocol,
        rule: e.rule
      }))
    },
    null,
    2
  );
}

export function exportFirewallEventsCsv(dataset: FirewallDataset): string {
  const lines = ['index,time,action,src,src_port,dst,dst_port,protocol,rule,iface'];
  for (const e of dataset.events) {
    lines.push(
      [e.index + 1, csv(e.time), e.action, csv(e.src), e.srcPort ?? '', csv(e.dst), e.dstPort ?? '', e.protocol, csv(e.rule), csv(e.iface)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportFirewallActionsCsv(dataset: FirewallDataset): string {
  const lines = ['action,count'];
  for (const a of dataset.actions) lines.push([a.name, a.count].join(','));
  return lines.join('\n');
}

export function resolveFirewallSuggestion(state: { hasFiles: boolean; hasError: boolean }): FirewallSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the edge firewall sample',
      reason: 'Load a local UFW-style log with allow, block, drop, and reject events.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a firewall log',
      reason: 'Drop a .log, .csv, or JSON export — or load the sample edge gateway log.',
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
