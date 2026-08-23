import { NMAP_XML_SAMPLE } from '../constants/nmap-sample.data';
import { NMAP_MAX_FILE_BYTES, NMAP_SUPPORTED_EXTENSIONS } from '../constants/nmap-report-viewer.constants';
import type {
  NmapDataset,
  NmapHost,
  NmapLoadedFile,
  NmapMetadataRow,
  NmapPort,
  NmapSuggestion
} from '../types/nmap-report-viewer.types';
import { parseNmapBytes } from './nmap-report-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatNmapFileSize,
  readFileBytes as readNmapFileBytes
} from './network-file.utils';

export { filterNmapHosts, filterNmapPorts, parseNmapBytes, parseNmapText } from './nmap-report-parse.utils';
export { nmapServiceColor, nmapStateColor, renderNmapHosts, renderNmapServices } from './nmap-report-render.utils';

export function isSupportedNmapFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (NMAP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateNmapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NMAP_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(NMAP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidNmapFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Nmap reports are not supported — decompress first' });
      continue;
    }
    if (!isSupportedNmapFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xml, .gnmap, .json, or .csv)' });
      continue;
    }
    const sizeError = validateNmapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNmapFile(): File {
  return new File([NMAP_XML_SAMPLE], 'sample-lab-nmap.xml', { type: 'application/xml', lastModified: 0 });
}

export function createNmapFileRecord(file: File, bytes: Uint8Array): NmapLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: NmapDataset | null = null;
  let softFail = false;
  try {
    parsed = parseNmapBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.hosts.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Nmap report');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportNmap(file: NmapLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildNmapMetadataRows(dataset: NmapDataset): NmapMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Hosts', value: String(dataset.hosts.length) },
    { key: 'Ports', value: String(dataset.ports.length) },
    { key: 'Open', value: String(dataset.ports.filter((p) => p.state === 'open').length) },
    { key: 'Services', value: dataset.services.slice(0, 6).map((s) => `${s.name} ${s.count}`).join(', ') || '—' }
  ];
}

export function buildNmapHostMetadata(host: NmapHost): NmapMetadataRow[] {
  return [
    { key: 'IP', value: host.ip },
    { key: 'Hostname', value: host.hostname || '—' },
    { key: 'Status', value: host.status },
    { key: 'OS', value: host.os || '—' },
    { key: 'Ports', value: String(host.ports.length) },
    { key: 'Open', value: String(host.openCount) }
  ];
}

export function buildNmapPortMetadata(port: NmapPort): NmapMetadataRow[] {
  return [
    { key: 'Host', value: port.hostname || port.ip },
    { key: 'Port', value: String(port.port) },
    { key: 'Protocol', value: port.protocol },
    { key: 'State', value: port.state },
    { key: 'Service', value: port.service || '—' },
    { key: 'Product', value: [port.product, port.version].filter(Boolean).join(' ') || '—' }
  ];
}

export function exportNmapSummaryJson(file: NmapLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Nmap report');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      args: parsed.args,
      sourceKind: parsed.sourceKind,
      hosts: parsed.hosts.map((h) => ({
        ip: h.ip,
        hostname: h.hostname,
        status: h.status,
        os: h.os,
        openCount: h.openCount,
        ports: h.ports.map((p) => ({ port: p.port, protocol: p.protocol, state: p.state, service: p.service }))
      }))
    },
    null,
    2
  );
}

export function exportNmapHostsCsv(dataset: NmapDataset): string {
  const lines = ['index,ip,hostname,status,os,ports,open'];
  for (const h of dataset.hosts) {
    lines.push([h.index + 1, csv(h.ip), csv(h.hostname), h.status, csv(h.os), h.ports.length, h.openCount].join(','));
  }
  return lines.join('\n');
}

export function exportNmapPortsCsv(dataset: NmapDataset): string {
  const lines = ['ip,hostname,port,protocol,state,service,product,version'];
  for (const p of dataset.ports) {
    lines.push([csv(p.ip), csv(p.hostname), p.port, p.protocol, p.state, csv(p.service), csv(p.product), csv(p.version)].join(','));
  }
  return lines.join('\n');
}

export function resolveNmapSuggestion(state: { hasFiles: boolean; hasError: boolean }): NmapSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the lab Nmap sample',
      reason: 'Load a local XML scan with three lab hosts, open/filtered ports, and services.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an Nmap report',
      reason: 'Drop Nmap XML, gnmap, or JSON — or load the sample lab scan.',
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
