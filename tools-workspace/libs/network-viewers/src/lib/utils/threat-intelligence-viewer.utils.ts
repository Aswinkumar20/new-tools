import { THREAT_JSON_SAMPLE } from '../constants/threat-intel-sample.data';
import { THREAT_MAX_FILE_BYTES, THREAT_SUPPORTED_EXTENSIONS } from '../constants/threat-intelligence-viewer.constants';
import type {
  ThreatDataset,
  ThreatIndicator,
  ThreatLoadedFile,
  ThreatMetadataRow,
  ThreatObject,
  ThreatRelationship,
  ThreatSuggestion
} from '../types/threat-intelligence-viewer.types';
import { parseThreatBytes } from './threat-intelligence-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatThreatFileSize,
  readFileBytes as readThreatFileBytes
} from './network-file.utils';

export {
  filterThreatIndicators,
  filterThreatObjects,
  filterThreatRelationships,
  parseThreatBytes,
  parseThreatText
} from './threat-intelligence-parse.utils';
export {
  renderThreatIndicatorTypes,
  renderThreatRelationships,
  threatIndicatorTypeColor,
  threatObjectKindColor,
  threatRelationshipColor
} from './threat-intelligence-render.utils';

export function isSupportedThreatFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (THREAT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateThreatFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > THREAT_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(THREAT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidThreatFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed threat intel feeds are not supported — decompress first' });
      continue;
    }
    if (!isSupportedThreatFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .xml, .csv, or .txt)' });
      continue;
    }
    const sizeError = validateThreatFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleThreatFile(): File {
  return new File([THREAT_JSON_SAMPLE], 'sample-threat-intel.json', { type: 'application/stix+json', lastModified: 0 });
}

export function createThreatFileRecord(file: File, bytes: Uint8Array): ThreatLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ThreatDataset | null = null;
  let softFail = false;
  try {
    parsed = parseThreatBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.indicators.length && !parsed.relationships.length && !parsed.objects.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse threat intel feed');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportThreat(file: ThreatLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildThreatMetadataRows(dataset: ThreatDataset): ThreatMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Indicators', value: String(dataset.indicators.length) },
    { key: 'Relationships', value: String(dataset.relationships.length) },
    { key: 'Objects', value: String(dataset.objects.length) },
    { key: 'IOC types', value: dataset.indicatorTypes.map((t) => `${t.name} ${t.count}`).join(', ') || '—' }
  ];
}

export function buildThreatIndicatorMetadata(ioc: ThreatIndicator): ThreatMetadataRow[] {
  return [
    { key: 'Name', value: ioc.name || '—' },
    { key: 'Type', value: ioc.type },
    { key: 'Value', value: ioc.value || '—' },
    { key: 'Labels', value: ioc.labels || '—' },
    { key: 'Confidence', value: ioc.confidence == null ? '—' : String(ioc.confidence) },
    { key: 'Valid from', value: ioc.validFrom || '—' },
    { key: 'Pattern', value: ioc.pattern || '—' }
  ];
}

export function buildThreatRelationshipMetadata(rel: ThreatRelationship): ThreatMetadataRow[] {
  return [
    { key: 'Type', value: rel.type },
    { key: 'Source', value: rel.sourceName || rel.sourceId || '—' },
    { key: 'Target', value: rel.targetName || rel.targetId || '—' }
  ];
}

export function buildThreatObjectMetadata(obj: ThreatObject): ThreatMetadataRow[] {
  return [
    { key: 'Kind', value: obj.kind },
    { key: 'Name', value: obj.name || '—' },
    { key: 'Aliases', value: obj.aliases || '—' },
    { key: 'Description', value: obj.description || '—' }
  ];
}

export function exportThreatSummaryJson(file: ThreatLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed threat intel feed');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      version: parsed.version,
      indicatorTypes: parsed.indicatorTypes,
      relationshipTypes: parsed.relationshipTypes,
      objectKinds: parsed.objectKinds,
      indicators: parsed.indicators.map((i) => ({
        type: i.type,
        value: i.value,
        name: i.name,
        labels: i.labels,
        confidence: i.confidence
      })),
      relationships: parsed.relationships.map((r) => ({
        type: r.type,
        source: r.sourceName,
        target: r.targetName
      })),
      objects: parsed.objects.map((o) => ({ kind: o.kind, name: o.name, aliases: o.aliases }))
    },
    null,
    2
  );
}

export function exportThreatIndicatorsCsv(dataset: ThreatDataset): string {
  const lines = ['index,type,value,name,labels,confidence'];
  for (const ioc of dataset.indicators) {
    lines.push([ioc.index + 1, csv(ioc.type), csv(ioc.value), csv(ioc.name), csv(ioc.labels), ioc.confidence ?? ''].join(','));
  }
  return lines.join('\n');
}

export function exportThreatRelationshipsCsv(dataset: ThreatDataset): string {
  const lines = ['index,type,source,target'];
  for (const rel of dataset.relationships) {
    lines.push([rel.index + 1, csv(rel.type), csv(rel.sourceName), csv(rel.targetName)].join(','));
  }
  return lines.join('\n');
}

export function resolveThreatSuggestion(state: { hasFiles: boolean; hasError: boolean }): ThreatSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the lab STIX sample',
      reason: 'Load a local STIX 2.1 bundle with indicators, actors, and relationships.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a threat intel feed',
      reason: 'Drop STIX JSON, XML, CSV, or a typed IOC list — or load the sample bundle.',
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
