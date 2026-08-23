import { PCAPNG_MAX_FILE_BYTES, PCAPNG_SUPPORTED_EXTENSIONS } from '../constants/pcapng-viewer.constants';
import type {
  PcapngDataset,
  PcapngInterface,
  PcapngLoadedFile,
  PcapngMetadataRow,
  PcapngPacket,
  PcapngSuggestion
} from '../types/pcapng-viewer.types';
import { buildSamplePcapngBytes } from './pcap-build.utils';
import { formatHexDump } from './pcap-parse.utils';
import { filterPcapngPackets, parsePcapngBytes } from './pcapng-parse.utils';
import { formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatPcapngFileSize,
  readFileBytes as readPcapngFileBytes
} from './network-file.utils';

export { buildSamplePcapngBytes, buildSamplePcapngMultiIfaceBytes } from './pcap-build.utils';
export { filterPcapngPackets, parsePcapngBytes } from './pcapng-parse.utils';
export { formatHexDump } from './pcap-parse.utils';
export { renderPcapngInterfaces, renderPcapngTimeline } from './pcapng-render.utils';
export { protocolColor } from './pcap-render.utils';

export function isSupportedPcapngFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PCAPNG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validatePcapngFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PCAPNG_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(PCAPNG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPcapngFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed PCAPNG files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPcapngFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pcapng)' });
      continue;
    }
    const sizeError = validatePcapngFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePcapngFile(): File {
  return new File([buildSamplePcapngBytes() as BlobPart], 'sample-dual-iface.pcapng', {
    type: 'application/x-pcapng',
    lastModified: 0
  });
}

export function createPcapngFileRecord(file: File, bytes: Uint8Array): PcapngLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: PcapngDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePcapngBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.packets.length && !parsed.interfaces.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PCAPNG');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportPcapng(file: PcapngLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPcapngMetadataRows(dataset: PcapngDataset): PcapngMetadataRow[] {
  return [
    { key: 'Hardware', value: dataset.section.hardware || '—' },
    { key: 'OS', value: dataset.section.os || '—' },
    { key: 'Application', value: dataset.section.application || '—' },
    { key: 'Endian', value: dataset.littleEndian ? 'little' : 'big' },
    { key: 'Interfaces', value: String(dataset.interfaces.length) },
    { key: 'Packets', value: String(dataset.packets.length) }
  ];
}

export function buildInterfaceMetadata(iface: PcapngInterface): PcapngMetadataRow[] {
  return [
    { key: 'Name', value: iface.name },
    { key: 'Description', value: iface.description || '—' },
    { key: 'Link', value: iface.linkTypeName },
    { key: 'MAC', value: iface.mac || '—' },
    { key: 'Snaplen', value: String(iface.snaplen) },
    { key: 'Speed', value: iface.speedBps ? `${Math.round(iface.speedBps / 1e6)} Mbps` : '—' },
    { key: 'Packets', value: String(iface.packets) },
    { key: 'Bytes', value: formatNetworkFileSize(iface.bytes) },
    { key: 'Received', value: iface.received ? String(iface.received) : '—' },
    { key: 'Dropped', value: String(iface.dropped) }
  ];
}

export function buildPcapngPacketMetadata(packet: PcapngPacket): PcapngMetadataRow[] {
  return [
    { key: 'No.', value: String(packet.index + 1) },
    { key: 'Interface', value: `${packet.interfaceName} (${packet.interfaceId})` },
    { key: 'Time', value: `${packet.relMs.toFixed(3)} ms` },
    { key: 'Protocol', value: packet.protocol },
    { key: 'Source', value: packet.srcPort != null ? `${packet.srcIp}:${packet.srcPort}` : packet.srcIp || packet.srcMac || '—' },
    { key: 'Destination', value: packet.dstPort != null ? `${packet.dstIp}:${packet.dstPort}` : packet.dstIp || packet.dstMac || '—' },
    { key: 'Length', value: String(packet.inclLen) },
    { key: 'Info', value: packet.info || '—' }
  ];
}

export function exportPcapngSummaryJson(file: PcapngLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PCAPNG data');
  return JSON.stringify(
    {
      file: file.name,
      section: parsed.section,
      interfaces: parsed.interfaces.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        linkType: i.linkTypeName,
        mac: i.mac,
        packets: i.packets,
        bytes: i.bytes,
        received: i.received,
        dropped: i.dropped
      })),
      packets: parsed.packets.map((p) => ({
        index: p.index + 1,
        iface: p.interfaceName,
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

export function exportPcapngInterfacesCsv(dataset: PcapngDataset): string {
  const lines = ['id,name,description,link,mac,snaplen,speed_bps,packets,bytes,received,dropped'];
  for (const i of dataset.interfaces) {
    lines.push(
      [i.id, csv(i.name), csv(i.description), csv(i.linkTypeName), csv(i.mac), i.snaplen, i.speedBps, i.packets, i.bytes, i.received, i.dropped].join(',')
    );
  }
  return lines.join('\n');
}

export function exportPcapngPacketsCsv(dataset: PcapngDataset): string {
  const lines = ['no,iface,time_ms,protocol,src,dst,length,info'];
  for (const p of dataset.packets) {
    lines.push(
      [p.index + 1, csv(p.interfaceName), p.relMs.toFixed(3), p.protocol, csv(p.srcIp), csv(p.dstIp), p.inclLen, csv(p.info)].join(',')
    );
  }
  return lines.join('\n');
}

export function hexForPcapngPacket(packet: PcapngPacket | null): string {
  return packet ? formatHexDump(packet.bytes) : '';
}

export function resolvePcapngSuggestion(state: { hasFiles: boolean; hasError: boolean }): PcapngSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the dual-interface PCAPNG sample',
      reason: 'Load eth0 + wlan0 blocks with HTTP, DNS, ARP, and interface statistics.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PCAPNG capture',
      reason: 'Drop a .pcapng file — or load the sample dual-interface capture.',
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
