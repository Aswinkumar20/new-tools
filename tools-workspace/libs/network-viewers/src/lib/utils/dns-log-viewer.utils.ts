import { DNS_LOG_SAMPLE } from '../constants/dns-sample.data';
import { DNS_LOG_MAX_FILE_BYTES, DNS_LOG_SUPPORTED_EXTENSIONS } from '../constants/dns-log-viewer.constants';
import type {
  DnsLogDataset,
  DnsLogLoadedFile,
  DnsLogMetadataRow,
  DnsLogSuggestion,
  DnsQuery
} from '../types/dns-log-viewer.types';
import { parseDnsLogBytes } from './dns-log-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatDnsLogFileSize,
  readFileBytes as readDnsLogFileBytes
} from './network-file.utils';

export { filterDnsQueries, parseDnsLogBytes, parseDnsLogText } from './dns-log-parse.utils';
export { dnsQtypeColor, dnsRcodeColor, renderDnsTimeline, renderDnsTypes } from './dns-log-render.utils';

export function isSupportedDnsLogFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DNS_LOG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateDnsLogFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DNS_LOG_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(DNS_LOG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDnsLogFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed DNS logs are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDnsLogFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .log, .csv, or .json)' });
      continue;
    }
    const sizeError = validateDnsLogFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDnsLogFile(): File {
  return new File([DNS_LOG_SAMPLE], 'sample-dns-resolver.log', { type: 'text/plain', lastModified: 0 });
}

export function createDnsLogFileRecord(file: File, bytes: Uint8Array): DnsLogLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DnsLogDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDnsLogBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.queries.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DNS log');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDnsLog(file: DnsLogLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDnsLogMetadataRows(dataset: DnsLogDataset): DnsLogMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Queries', value: String(dataset.queries.length) },
    { key: 'Types', value: dataset.types.map((t) => `${t.name} ${t.count}`).join(', ') || '—' },
    { key: 'Rcodes', value: dataset.rcodes.map((r) => `${r.name} ${r.count}`).join(', ') || '—' },
    { key: 'Span', value: `${Math.round(dataset.durationMs)} ms` }
  ];
}

export function buildDnsQueryMetadata(query: DnsQuery): DnsLogMetadataRow[] {
  return [
    { key: 'Time', value: query.time },
    { key: 'Client', value: query.clientPort != null ? `${query.client}:${query.clientPort}` : query.client || '—' },
    { key: 'Name', value: query.qname || '—' },
    { key: 'Type', value: query.qtype },
    { key: 'Class', value: query.qclass },
    { key: 'Rcode', value: query.rcode || '—' },
    { key: 'Answer', value: query.answer || '—' },
    { key: 'Flags', value: query.flags || '—' }
  ];
}

export function exportDnsLogSummaryJson(file: DnsLogLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DNS log');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      types: parsed.types,
      rcodes: parsed.rcodes,
      queries: parsed.queries.map((q) => ({
        time: q.time,
        client: q.client,
        qname: q.qname,
        qtype: q.qtype,
        rcode: q.rcode,
        answer: q.answer
      }))
    },
    null,
    2
  );
}

export function exportDnsQueriesCsv(dataset: DnsLogDataset): string {
  const lines = ['index,time,client,client_port,qname,qtype,rcode,answer'];
  for (const q of dataset.queries) {
    lines.push(
      [q.index + 1, csv(q.time), csv(q.client), q.clientPort ?? '', csv(q.qname), q.qtype, q.rcode || '', csv(q.answer)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportDnsTypesCsv(dataset: DnsLogDataset): string {
  const lines = ['qtype,count'];
  for (const t of dataset.types) lines.push([t.name, t.count].join(','));
  return lines.join('\n');
}

export function resolveDnsLogSuggestion(state: { hasFiles: boolean; hasError: boolean }): DnsLogSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the resolver DNS sample',
      reason: 'Load a local BIND/dnsmasq dump with A, AAAA, MX, TXT, and NXDOMAIN.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DNS log',
      reason: 'Drop a BIND, dnsmasq, CSV, or JSON dump — or load the sample resolver log.',
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
