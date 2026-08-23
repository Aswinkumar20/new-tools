import { PACKET_ANALYZER_MAX_FILE_BYTES, PACKET_ANALYZER_SUPPORTED_EXTENSIONS } from '../constants/packet-analyzer.constants';
import type {
  PacketAnalyzerDataset,
  PacketAnalyzerLoadedFile,
  PacketAnalyzerMetadataRow,
  PacketAnalyzerPacket,
  PacketAnalyzerSuggestion,
  PacketLayer
} from '../types/packet-analyzer.types';
import { buildSamplePcapBytes } from './pcap-build.utils';
import { filterAnalyzerPackets, parsePacketAnalyzerBytes } from './packet-analyzer-parse.utils';
import { hexForLayer } from './packet-dissect.utils';
import { formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatPacketAnalyzerFileSize,
  readFileBytes as readPacketAnalyzerFileBytes
} from './network-file.utils';

export { buildSamplePcapBytes } from './pcap-build.utils';
export { formatHexDump } from './pcap-parse.utils';
export { filterAnalyzerPackets, parsePacketAnalyzerBytes, parseHexDumpText } from './packet-analyzer-parse.utils';
export { layerColor, renderPacketLayers } from './packet-analyzer-render.utils';
export { dissectPacket, enrichPackets, hexForLayer } from './packet-dissect.utils';
export { protocolColor } from './pcap-render.utils';

export function isSupportedPacketAnalyzerFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PACKET_ANALYZER_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validatePacketAnalyzerFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PACKET_ANALYZER_MAX_FILE_BYTES) {
    return `File is too large (max ${formatNetworkFileSize(PACKET_ANALYZER_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidPacketAnalyzerFiles(files: FileList | File[]): {
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
    if (!isSupportedPacketAnalyzerFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pcap/.pcapng or a hex dump)' });
      continue;
    }
    const sizeError = validatePacketAnalyzerFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePacketAnalyzerFile(): File {
  return new File([buildSamplePcapBytes() as BlobPart], 'sample-dpi.pcap', {
    type: 'application/vnd.tcpdump.pcap',
    lastModified: 0
  });
}

export function createPacketAnalyzerFileRecord(file: File, bytes: Uint8Array): PacketAnalyzerLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: PacketAnalyzerDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePacketAnalyzerBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.packets.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse packet data');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportPacketAnalyzer(file: PacketAnalyzerLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPacketAnalyzerMetadataRows(dataset: PacketAnalyzerDataset): PacketAnalyzerMetadataRow[] {
  const proto = new Map<string, number>();
  dataset.packets.forEach((p) => proto.set(p.protocol, (proto.get(p.protocol) ?? 0) + 1));
  return [
    { key: 'Format', value: dataset.format.toUpperCase() },
    { key: 'Link', value: dataset.linkTypeName },
    { key: 'Packets', value: String(dataset.packets.length) },
    { key: 'Protocols', value: [...proto.entries()].map(([k, n]) => `${k} ${n}`).join(', ') || '—' }
  ];
}

export function buildLayerMetadata(layer: PacketLayer): PacketAnalyzerMetadataRow[] {
  return [
    { key: 'Layer', value: layer.name },
    { key: 'Summary', value: layer.summary },
    { key: 'Offset', value: String(layer.offset) },
    { key: 'Length', value: String(layer.length) },
    ...layer.fields.map((f) => ({ key: f.name, value: f.value }))
  ];
}

export function buildSelectedPacketMetadata(packet: PacketAnalyzerPacket): PacketAnalyzerMetadataRow[] {
  return [
    { key: 'No.', value: String(packet.index + 1) },
    { key: 'Time', value: `${packet.relMs.toFixed(3)} ms` },
    { key: 'Protocol', value: packet.protocol },
    { key: 'Source', value: packet.srcPort != null ? `${packet.srcIp}:${packet.srcPort}` : packet.srcIp || packet.srcMac || '—' },
    { key: 'Destination', value: packet.dstPort != null ? `${packet.dstIp}:${packet.dstPort}` : packet.dstIp || packet.dstMac || '—' },
    { key: 'Length', value: String(packet.inclLen) },
    { key: 'Layers', value: packet.layers.map((l) => l.name).join(' / ') },
    { key: 'Info', value: packet.info || '—' }
  ];
}

export function exportPacketAnalyzerSummaryJson(file: PacketAnalyzerLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed packet data');
  return JSON.stringify(
    {
      file: file.name,
      format: parsed.format,
      linkType: parsed.linkTypeName,
      packets: parsed.packets.map((p) => ({
        index: p.index + 1,
        protocol: p.protocol,
        src: p.srcIp,
        dst: p.dstIp,
        info: p.info,
        layers: p.layers.map((l) => l.name)
      }))
    },
    null,
    2
  );
}

export function exportPacketDecodeJson(file: PacketAnalyzerLoadedFile, packet: PacketAnalyzerPacket | null): string {
  const target = packet ?? file.parsed?.packets[0] ?? null;
  if (!file.parsed || !target) throw new Error('No packet to decode');
  return JSON.stringify(
    {
      file: file.name,
      index: target.index + 1,
      protocol: target.protocol,
      info: target.info,
      layers: target.layers
    },
    null,
    2
  );
}

export function exportPacketAnalyzerCsv(dataset: PacketAnalyzerDataset): string {
  const lines = ['no,time_ms,protocol,src,dst,length,layers,info'];
  for (const p of dataset.packets) {
    lines.push(
      [
        p.index + 1,
        p.relMs.toFixed(3),
        p.protocol,
        csv(p.srcIp),
        csv(p.dstIp),
        p.inclLen,
        csv(p.layers.map((l) => l.name).join('|')),
        csv(p.info)
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function hexForSelectedLayer(packet: PacketAnalyzerPacket | null, layer: PacketLayer | null): string {
  return hexForLayer(packet, layer);
}

export function resolvePacketAnalyzerSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
}): PacketAnalyzerSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the DPI sample capture',
      reason: 'Load a local Ethernet capture with TCP/HTTP, DNS, and ARP layer decode.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a capture or hex dump',
      reason: 'Drop a .pcap/.pcapng or hex dump — or load the sample DPI capture.',
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
