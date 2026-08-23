import { TRAFFIC_JSON_SAMPLE } from '../constants/traffic-sample.data';
import { TRAFFIC_MAX_FILE_BYTES, TRAFFIC_SUPPORTED_EXTENSIONS } from '../constants/network-traffic-viewer.constants';
import type {
  TrafficDataset,
  TrafficFlow,
  TrafficLoadedFile,
  TrafficMetadataRow,
  TrafficSuggestion
} from '../types/network-traffic-viewer.types';
import { parseTrafficBytes } from './traffic-parse.utils';
import { formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatTrafficFileSize,
  readFileBytes as readTrafficFileBytes
} from './network-file.utils';

export { filterTrafficFlows, flowsFromPackets, parseTrafficBytes, parseTrafficText } from './traffic-parse.utils';
export { protocolBarRows, renderTrafficBars, talkerBarRows } from './traffic-render.utils';

export function isSupportedTrafficFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TRAFFIC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateTrafficFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TRAFFIC_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(TRAFFIC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTrafficFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed traffic files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTrafficFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pcap/.pcapng, .json, .csv, or .flow)' });
      continue;
    }
    const sizeError = validateTrafficFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTrafficFile(): File {
  return new File([TRAFFIC_JSON_SAMPLE], 'sample-office-lan.json', { type: 'application/json', lastModified: 0 });
}

export function createTrafficFileRecord(file: File, bytes: Uint8Array): TrafficLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const warnings: string[] = [];
  let parsed: TrafficDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTrafficBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.flows.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse traffic data');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTraffic(file: TrafficLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTrafficMetadataRows(dataset: TrafficDataset): TrafficMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Flows', value: String(dataset.flows.length) },
    { key: 'Packets', value: String(dataset.totalPackets) },
    { key: 'Bytes', value: formatNetworkFileSize(dataset.totalBytes) },
    { key: 'Duration', value: `${Math.round(dataset.durationMs)} ms` },
    { key: 'Protocols', value: dataset.protocols.map((p) => p.name).join(', ') || '—' },
    { key: 'Talkers', value: String(dataset.talkers.length) }
  ];
}

export function buildFlowMetadata(flow: TrafficFlow): TrafficMetadataRow[] {
  return [
    { key: 'Protocol', value: flow.protocol },
    { key: 'Source', value: flow.srcPort != null ? `${flow.src}:${flow.srcPort}` : flow.src },
    { key: 'Destination', value: flow.dstPort != null ? `${flow.dst}:${flow.dstPort}` : flow.dst },
    { key: 'Packets', value: String(flow.packets) },
    { key: 'Bytes', value: formatNetworkFileSize(flow.bytes) },
    { key: 'Start', value: `${flow.startMs.toFixed(1)} ms` },
    { key: 'End', value: `${flow.endMs.toFixed(1)} ms` }
  ];
}

export function exportTrafficSummaryJson(file: TrafficLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed traffic data');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      totalPackets: parsed.totalPackets,
      totalBytes: parsed.totalBytes,
      durationMs: parsed.durationMs,
      protocols: parsed.protocols,
      talkers: parsed.talkers,
      flows: parsed.flows
    },
    null,
    2
  );
}

export function exportTrafficFlowsCsv(dataset: TrafficDataset): string {
  const lines = ['protocol,src,src_port,dst,dst_port,packets,bytes,start_ms,end_ms'];
  for (const f of dataset.flows) {
    lines.push([f.protocol, csv(f.src), f.srcPort ?? '', csv(f.dst), f.dstPort ?? '', f.packets, f.bytes, f.startMs, f.endMs].join(','));
  }
  return lines.join('\n');
}

export function exportTrafficTalkersCsv(dataset: TrafficDataset): string {
  const lines = ['host,packets,bytes'];
  for (const t of dataset.talkers) lines.push([csv(t.host), t.packets, t.bytes].join(','));
  return lines.join('\n');
}

export function resolveTrafficSuggestion(state: { hasFiles: boolean; hasError: boolean }): TrafficSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the office LAN sample',
      reason: 'Load a local flow dump with HTTP, DNS, TCP, and multicast talkers.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open traffic or a capture',
      reason: 'Drop PCAP/PCAPNG or a JSON/CSV flow dump — or load the sample office LAN snapshot.',
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
