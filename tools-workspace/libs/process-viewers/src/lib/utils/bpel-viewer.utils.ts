import { BPEL_XML_SAMPLE } from '../constants/bpel-sample.data';
import { BPEL_MAX_FILE_BYTES, BPEL_SUPPORTED_EXTENSIONS } from '../constants/bpel-viewer.constants';
import type {
  BpelActivity,
  BpelDataset,
  BpelLoadedFile,
  BpelMetadataRow,
  BpelPartner,
  BpelSuggestion
} from '../types/bpel-viewer.types';
import { parseBpelBytes } from './bpel-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatBpelFileSize,
  readFileBytes as readBpelFileBytes
} from './process-file.utils';

export { filterBpelActivities, filterBpelPartners, parseBpelBytes, parseBpelText } from './bpel-parse.utils';
export { bpelKindColor, renderBpelKinds, renderBpelOrchestration, renderBpelPartners } from './bpel-render.utils';

export function isSupportedBpelFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (BPEL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateBpelFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > BPEL_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(BPEL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidBpelFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed BPEL files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedBpelFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .bpel, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateBpelFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleBpelFile(): File {
  return new File([BPEL_XML_SAMPLE], 'sample-loan-approval.bpel', { type: 'application/xml', lastModified: 0 });
}

export function createBpelFileRecord(file: File, bytes: Uint8Array): BpelLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: BpelDataset | null = null;
  let softFail = false;
  try {
    parsed = parseBpelBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.activities.length && !parsed.partners.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse BPEL process');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportBpel(file: BpelLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildBpelMetadataRows(dataset: BpelDataset): BpelMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Namespace', value: dataset.namespace || '—' },
    { key: 'Partners', value: String(dataset.partners.length) },
    { key: 'Variables', value: String(dataset.variables.length) },
    { key: 'Activities', value: String(dataset.activities.length) },
    { key: 'Kinds', value: dataset.kinds.map((k) => `${k.name} ${k.count}`).join(', ') || '—' }
  ];
}

export function buildBpelActivityMetadata(activity: BpelActivity): BpelMetadataRow[] {
  return [
    { key: 'Name', value: activity.name },
    { key: 'Kind', value: activity.kind },
    { key: 'Partner', value: activity.partner || '—' },
    { key: 'Operation', value: activity.operation || '—' },
    { key: 'Variable', value: activity.variable || '—' },
    { key: 'Start', value: activity.createInstance ? 'yes' : 'no' },
    { key: 'Parent', value: activity.parentName || '—' }
  ];
}

export function buildBpelPartnerMetadata(partner: BpelPartner): BpelMetadataRow[] {
  return [
    { key: 'Name', value: partner.name },
    { key: 'Type', value: partner.type || '—' },
    { key: 'My role', value: partner.myRole || '—' },
    { key: 'Partner role', value: partner.partnerRole || '—' },
    { key: 'Activities', value: String(partner.activityCount) }
  ];
}

export function exportBpelSummaryJson(file: BpelLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed BPEL process');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      namespace: parsed.namespace,
      kinds: parsed.kinds,
      partners: parsed.partners,
      variables: parsed.variables,
      activities: parsed.activities.map((a) => ({
        name: a.name,
        kind: a.kind,
        partner: a.partner,
        operation: a.operation,
        parent: a.parentName
      }))
    },
    null,
    2
  );
}

export function exportBpelActivitiesCsv(dataset: BpelDataset): string {
  const lines = ['index,kind,name,partner,operation,parent'];
  for (const a of dataset.activities) {
    lines.push([a.index + 1, a.kind, csv(a.name), csv(a.partner), csv(a.operation), csv(a.parentName)].join(','));
  }
  return lines.join('\n');
}

export function exportBpelPartnersCsv(dataset: BpelDataset): string {
  const lines = ['index,name,type,my_role,partner_role,activities'];
  for (const p of dataset.partners) {
    lines.push([p.index + 1, csv(p.name), csv(p.type), csv(p.myRole), csv(p.partnerRole), p.activityCount].join(','));
  }
  return lines.join('\n');
}

export function resolveBpelSuggestion(state: { hasFiles: boolean; hasError: boolean }): BpelSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the loan approval BPEL sample',
      reason: 'Load a local WS-BPEL process with partner links, receive/invoke/reply, and branching.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a BPEL process',
      reason: 'Drop .bpel, XML, JSON, or CSV — or load the sample loan approval orchestration.',
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
