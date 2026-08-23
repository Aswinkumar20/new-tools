import { NESSUS_XML_SAMPLE } from '../constants/nessus-sample.data';
import { NESSUS_MAX_FILE_BYTES, NESSUS_SUPPORTED_EXTENSIONS } from '../constants/nessus-report-viewer.constants';
import type {
  NessusDataset,
  NessusFinding,
  NessusHostStat,
  NessusLoadedFile,
  NessusMetadataRow,
  NessusSuggestion
} from '../types/nessus-report-viewer.types';
import { parseNessusBytes } from './nessus-report-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatNessusFileSize,
  readFileBytes as readNessusFileBytes
} from './network-file.utils';

export { filterNessusFindings, filterNessusHosts, parseNessusBytes, parseNessusText } from './nessus-report-parse.utils';
export { nessusSeverityColor, renderNessusHosts, renderNessusSeverity } from './nessus-report-render.utils';

export function isSupportedNessusFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (NESSUS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateNessusFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NESSUS_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(NESSUS_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidNessusFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Nessus reports are not supported — decompress first' });
      continue;
    }
    if (!isSupportedNessusFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .nessus, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateNessusFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNessusFile(): File {
  return new File([NESSUS_XML_SAMPLE], 'sample-lab.nessus', { type: 'application/xml', lastModified: 0 });
}

export function createNessusFileRecord(file: File, bytes: Uint8Array): NessusLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: NessusDataset | null = null;
  let softFail = false;
  try {
    parsed = parseNessusBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.findings.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Nessus report');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportNessus(file: NessusLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildNessusMetadataRows(dataset: NessusDataset): NessusMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Findings', value: String(dataset.findings.length) },
    { key: 'Hosts', value: String(dataset.hosts.length) },
    { key: 'Severities', value: dataset.severities.map((s) => `${s.name} ${s.count}`).join(', ') || '—' }
  ];
}

export function buildNessusFindingMetadata(finding: NessusFinding): NessusMetadataRow[] {
  return [
    { key: 'Host', value: finding.host || finding.ip || '—' },
    { key: 'IP', value: finding.ip || '—' },
    { key: 'Port', value: `${finding.port}/${finding.protocol}` },
    { key: 'Severity', value: finding.severity },
    { key: 'Plugin', value: finding.pluginName },
    { key: 'Plugin ID', value: finding.pluginId || '—' },
    { key: 'CVSS', value: finding.cvss == null ? '—' : String(finding.cvss) },
    { key: 'CVE', value: finding.cve || '—' },
    { key: 'Synopsis', value: finding.synopsis || '—' },
    { key: 'Solution', value: finding.solution || '—' }
  ];
}

export function buildNessusHostMetadata(host: NessusHostStat): NessusMetadataRow[] {
  return [
    { key: 'Host', value: host.name },
    { key: 'IP', value: host.ip || '—' },
    { key: 'Findings', value: String(host.count) },
    { key: 'Critical', value: String(host.critical) },
    { key: 'High', value: String(host.high) },
    { key: 'Medium', value: String(host.medium) },
    { key: 'Low', value: String(host.low) },
    { key: 'Info', value: String(host.info) }
  ];
}

export function exportNessusSummaryJson(file: NessusLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Nessus report');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      severities: parsed.severities,
      hosts: parsed.hosts,
      findings: parsed.findings.map((f) => ({
        host: f.host,
        ip: f.ip,
        port: f.port,
        severity: f.severity,
        pluginId: f.pluginId,
        pluginName: f.pluginName,
        cvss: f.cvss,
        cve: f.cve
      }))
    },
    null,
    2
  );
}

export function exportNessusFindingsCsv(dataset: NessusDataset): string {
  const lines = ['index,host,ip,port,protocol,severity,plugin_id,plugin_name,cvss,cve'];
  for (const f of dataset.findings) {
    lines.push(
      [f.index + 1, csv(f.host), csv(f.ip), f.port, f.protocol, f.severity, csv(f.pluginId), csv(f.pluginName), f.cvss ?? '', csv(f.cve)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportNessusHostsCsv(dataset: NessusDataset): string {
  const lines = ['host,ip,findings,critical,high,medium,low,info'];
  for (const h of dataset.hosts) {
    lines.push([csv(h.name), csv(h.ip), h.count, h.critical, h.high, h.medium, h.low, h.info].join(','));
  }
  return lines.join('\n');
}

export function resolveNessusSuggestion(state: { hasFiles: boolean; hasError: boolean }): NessusSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the lab Nessus sample',
      reason: 'Load a local .nessus export with critical, high, and informational findings.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Nessus report',
      reason: 'Drop a .nessus, XML, CSV, or JSON export — or load the sample lab scan.',
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
