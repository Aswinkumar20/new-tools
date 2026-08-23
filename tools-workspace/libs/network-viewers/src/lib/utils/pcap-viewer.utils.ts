import { PCAP_MAX_FILE_BYTES, PCAP_SUPPORTED_EXTENSIONS } from '../constants/pcap-viewer.constants';
import type { PcapDataset, PcapLoadedFile, PcapMetadataRow, PcapPacket, PcapSuggestion } from '../types/pcap-viewer.types';
import { buildSamplePcapBytes } from './pcap-build.utils';
import { filterPcapPackets, formatHexDump, parsePcapBytes } from './pcap-parse.utils';
import { formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatPcapFileSize,
  readFileBytes as readPcapFileBytes
} from './network-file.utils';

export { buildSamplePcapBytes, buildSamplePcapngBytes } from './pcap-build.utils';
export { filterPcapPackets, formatHexDump, parsePcapBytes } from './pcap-parse.utils';
export { protocolColor, renderPcapTimeline } from './pcap-render.utils';

export function isSupportedPcapFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PCAP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validatePcapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PCAP_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(PCAP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPcapFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed captures are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPcapFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pcap or .pcapng)' });
      continue;
    }
    const sizeError = validatePcapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePcapFile(): File {
  return new File([buildSamplePcapBytes() as BlobPart], 'sample-http-dns.pcap', {
    type: 'application/vnd.tcpdump.pcap',
    lastModified: 0
  });
}

export function createPcapFileRecord(file: File, bytes: Uint8Array): PcapLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: PcapDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePcapBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.packets.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse capture');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportPcap(file: PcapLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPcapMetadataRows(dataset: PcapDataset): PcapMetadataRow[] {
  const proto = new Map<string, number>();
  dataset.packets.forEach((p) => proto.set(p.protocol, (proto.get(p.protocol) ?? 0) + 1));
  return [
    { key: 'Format', value: dataset.format.toUpperCase() },
    { key: 'Link', value: dataset.linkTypeName },
    { key: 'Endian', value: dataset.littleEndian ? 'little' : 'big' },
    { key: 'Snaplen', value: String(dataset.snaplen) },
    { key: 'Packets', value: String(dataset.packets.length) },
    { key: 'Streams', value: String(dataset.streams.length) },
    { key: 'Protocols', value: [...proto.entries()].map(([k, n]) => `${k} ${n}`).join(', ') || '—' }
  ];
}

export function buildPacketMetadata(packet: PcapPacket): PcapMetadataRow[] {
  return [
    { key: 'No.', value: String(packet.index + 1) },
    { key: 'Time', value: `${packet.relMs.toFixed(3)} ms` },
    { key: 'Protocol', value: packet.protocol },
    { key: 'Source', value: packet.srcPort != null ? `${packet.srcIp}:${packet.srcPort}` : packet.srcIp || packet.srcMac || '—' },
    { key: 'Destination', value: packet.dstPort != null ? `${packet.dstIp}:${packet.dstPort}` : packet.dstIp || packet.dstMac || '—' },
    { key: 'Length', value: `${packet.inclLen}${packet.origLen !== packet.inclLen ? ` / ${packet.origLen}` : ''}` },
    { key: 'Flags', value: packet.tcpFlags || '—' },
    { key: 'Info', value: packet.info || '—' }
  ];
}

export function exportPcapSummaryJson(file: PcapLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed capture');
  return JSON.stringify(
    {
      file: file.name,
      format: parsed.format,
      linkType: parsed.linkTypeName,
      packets: parsed.packets.length,
      streams: parsed.streams.map((s) => ({ id: s.id, protocol: s.protocol, src: s.src, dst: s.dst, packets: s.packetIndexes.length })),
      summary: parsed.packets.map((p) => ({
        index: p.index + 1,
        relMs: p.relMs,
        protocol: p.protocol,
        src: p.srcIp,
        dst: p.dstIp,
        info: p.info
      }))
    },
    null,
    2
  );
}

export function exportPcapPacketsCsv(dataset: PcapDataset): string {
  const lines = ['no,time_ms,protocol,src,dst,src_port,dst_port,length,info'];
  for (const p of dataset.packets) {
    lines.push(
      [p.index + 1, p.relMs.toFixed(3), p.protocol, csv(p.srcIp), csv(p.dstIp), p.srcPort ?? '', p.dstPort ?? '', p.inclLen, csv(p.info)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportPcapStreamText(dataset: PcapDataset, streamId: string): string {
  const stream = dataset.streams.find((s) => s.id === streamId) ?? dataset.streams[0];
  if (!stream) throw new Error('No TCP stream to export');
  return `# ${stream.protocol} ${stream.src} ↔ ${stream.dst}\n# packets ${stream.packetIndexes.map((i) => i + 1).join(',')}\n\n${stream.text}\n`;
}

export function resolvePcapSuggestion(state: { hasFiles: boolean; hasError: boolean }): PcapSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the HTTP/DNS PCAP sample',
      reason: 'Load a local Ethernet capture with TCP handshake, HTTP, DNS, and ARP.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a packet capture',
      reason: 'Drop a .pcap or .pcapng file — or load the sample HTTP/DNS conversation.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

export { filterPcapPackets as filterPackets };

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function hexForPacket(packet: PcapPacket | null): string {
  return packet ? formatHexDump(packet.bytes) : '';
}
