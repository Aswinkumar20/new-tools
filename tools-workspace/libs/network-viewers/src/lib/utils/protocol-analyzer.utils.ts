import { PROTOCOL_JSON_SAMPLE } from '../constants/protocol-sample.data';
import {
  PROTOCOL_ANALYZER_MAX_FILE_BYTES,
  PROTOCOL_ANALYZER_SUPPORTED_EXTENSIONS
} from '../constants/protocol-analyzer.constants';
import type {
  ProtocolAnalyzerDataset,
  ProtocolAnalyzerLoadedFile,
  ProtocolAnalyzerMetadataRow,
  ProtocolAnalyzerSuggestion,
  ProtocolDissector
} from '../types/protocol-analyzer.types';
import { buildSamplePcapBytes } from './pcap-build.utils';
import { parseProtocolAnalyzerBytes } from './protocol-analyzer-parse.utils';
import { formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatProtocolAnalyzerFileSize,
  readFileBytes as readProtocolAnalyzerFileBytes
} from './network-file.utils';

export { buildSamplePcapBytes } from './pcap-build.utils';
export { protocolColor } from './pcap-render.utils';
export {
  filterProtocolDissectors,
  filterProtocolPackets,
  parseProtocolAnalyzerBytes,
  parseProtocolJson
} from './protocol-analyzer-parse.utils';
export { renderProtocolBars, renderProtocolTimeline } from './protocol-analyzer-render.utils';
export { buildDissectors } from './packet-dissect.utils';

export function isSupportedProtocolAnalyzerFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PROTOCOL_ANALYZER_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateProtocolAnalyzerFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PROTOCOL_ANALYZER_MAX_FILE_BYTES) {
    return `File is too large (max ${formatNetworkFileSize(PROTOCOL_ANALYZER_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidProtocolAnalyzerFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed protocol traces are not supported — decompress first' });
      continue;
    }
    if (!isSupportedProtocolAnalyzerFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pcap/.pcapng or protocol JSON)' });
      continue;
    }
    const sizeError = validateProtocolAnalyzerFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleProtocolAnalyzerFile(): File {
  return new File([buildSamplePcapBytes() as BlobPart], 'sample-protocol-mix.pcap', {
    type: 'application/vnd.tcpdump.pcap',
    lastModified: 0
  });
}

export function createSampleProtocolJsonFile(): File {
  return new File([PROTOCOL_JSON_SAMPLE], 'sample-protocol-mix.json', { type: 'application/json', lastModified: 0 });
}

export function createProtocolAnalyzerFileRecord(file: File, bytes: Uint8Array): ProtocolAnalyzerLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: ProtocolAnalyzerDataset | null = null;
  let softFail = false;
  try {
    parsed = parseProtocolAnalyzerBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.dissectors.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse protocol trace');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportProtocolAnalyzer(file: ProtocolAnalyzerLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildProtocolAnalyzerMetadataRows(dataset: ProtocolAnalyzerDataset): ProtocolAnalyzerMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Dissectors', value: String(dataset.dissectors.length) },
    { key: 'Packets', value: String(dataset.totalPackets) },
    { key: 'Bytes', value: formatNetworkFileSize(dataset.totalBytes) },
    { key: 'Duration', value: `${Math.round(dataset.durationMs)} ms` },
    { key: 'Protocols', value: dataset.dissectors.map((d) => d.name).join(', ') || '—' }
  ];
}

export function buildDissectorMetadata(dissector: ProtocolDissector): ProtocolAnalyzerMetadataRow[] {
  return [
    { key: 'Protocol', value: dissector.name },
    { key: 'Packets', value: String(dissector.packets) },
    { key: 'Bytes', value: formatNetworkFileSize(dissector.bytes) },
    { key: 'Conversations', value: String(dissector.conversations) },
    { key: 'Ports', value: dissector.ports.join(', ') || '—' },
    { key: 'Span', value: `${dissector.firstMs.toFixed(1)}–${dissector.lastMs.toFixed(1)} ms` },
    { key: 'Samples', value: dissector.sampleInfo.join(' · ') || '—' }
  ];
}

export function exportProtocolSummaryJson(file: ProtocolAnalyzerLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed protocol data');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      totalPackets: parsed.totalPackets,
      totalBytes: parsed.totalBytes,
      durationMs: parsed.durationMs,
      dissectors: parsed.dissectors
    },
    null,
    2
  );
}

export function exportProtocolDissectorsCsv(dataset: ProtocolAnalyzerDataset): string {
  const lines = ['name,packets,bytes,conversations,ports,first_ms,last_ms'];
  for (const d of dataset.dissectors) {
    lines.push(
      [csv(d.name), d.packets, d.bytes, d.conversations, csv(d.ports.join('|')), d.firstMs, d.lastMs].join(',')
    );
  }
  return lines.join('\n');
}

export function exportProtocolPacketsCsv(dataset: ProtocolAnalyzerDataset): string {
  const lines = ['no,time_ms,protocol,src,dst,src_port,dst_port,length,info'];
  for (const p of dataset.packets) {
    lines.push(
      [p.index + 1, p.relMs.toFixed(3), p.protocol, csv(p.srcIp), csv(p.dstIp), p.srcPort ?? '', p.dstPort ?? '', p.inclLen, csv(p.info)].join(',')
    );
  }
  return lines.join('\n');
}

export function resolveProtocolAnalyzerSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
}): ProtocolAnalyzerSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the protocol mix sample',
      reason: 'Load a local capture with Ethernet, IP, TCP/HTTP, DNS, and ARP dissectors.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a protocol trace',
      reason: 'Drop PCAP/PCAPNG or a dissector JSON dump — or load the sample protocol mix.',
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
