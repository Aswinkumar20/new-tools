import { PNML_XML_SAMPLE } from '../constants/pnml-sample.data';
import { PNML_MAX_FILE_BYTES, PNML_SUPPORTED_EXTENSIONS } from '../constants/pnml-viewer.constants';
import type {
  PnmlDataset,
  PnmlLoadedFile,
  PnmlMetadataRow,
  PnmlPlace,
  PnmlSuggestion,
  PnmlTokenMarking,
  PnmlTransition
} from '../types/pnml-viewer.types';
import { parsePnmlBytes } from './pnml-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatPnmlFileSize,
  readFileBytes as readPnmlFileBytes
} from './process-file.utils';

export {
  filterPnmlPlaces,
  filterPnmlTokens,
  filterPnmlTransitions,
  parsePnmlBytes,
  parsePnmlText
} from './pnml-parse.utils';
export { pnmlPlaceColor, pnmlTransitionColor, renderPnmlMarkings, renderPnmlNet, renderPnmlTransitions } from './pnml-render.utils';

export function isSupportedPnmlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PNML_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validatePnmlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PNML_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(PNML_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPnmlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed PNML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPnmlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pnml, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validatePnmlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePnmlFile(): File {
  return new File([PNML_XML_SAMPLE], 'sample-order-net.pnml', { type: 'application/xml', lastModified: 0 });
}

export function createPnmlFileRecord(file: File, bytes: Uint8Array): PnmlLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PnmlDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePnmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.places.length && !parsed.transitions.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PNML net');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPnml(file: PnmlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPnmlMetadataRows(dataset: PnmlDataset): PnmlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Net type', value: dataset.netType || '—' },
    { key: 'Places', value: String(dataset.places.length) },
    { key: 'Transitions', value: String(dataset.transitions.length) },
    { key: 'Arcs', value: String(dataset.arcs.length) },
    { key: 'Tokens', value: String(dataset.tokenTotal) },
    { key: 'Enabled', value: String(dataset.enabledCount) }
  ];
}

export function buildPnmlPlaceMetadata(place: PnmlPlace): PnmlMetadataRow[] {
  return [
    { key: 'ID', value: place.id },
    { key: 'Name', value: place.name },
    { key: 'Tokens', value: String(place.tokens) },
    { key: 'Incoming', value: String(place.inCount) },
    { key: 'Outgoing', value: String(place.outCount) }
  ];
}

export function buildPnmlTransitionMetadata(transition: PnmlTransition): PnmlMetadataRow[] {
  return [
    { key: 'ID', value: transition.id },
    { key: 'Name', value: transition.name },
    { key: 'Enabled', value: transition.enabled ? 'yes' : 'no' },
    { key: 'Incoming', value: String(transition.inCount) },
    { key: 'Outgoing', value: String(transition.outCount) }
  ];
}

export function buildPnmlTokenMetadata(token: PnmlTokenMarking): PnmlMetadataRow[] {
  return [
    { key: 'Place', value: token.placeName },
    { key: 'ID', value: token.placeId },
    { key: 'Tokens', value: String(token.tokens) }
  ];
}

export function exportPnmlSummaryJson(file: PnmlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PNML net');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      netType: parsed.netType,
      tokenTotal: parsed.tokenTotal,
      enabledCount: parsed.enabledCount,
      places: parsed.places.map((p) => ({ id: p.id, name: p.name, tokens: p.tokens })),
      transitions: parsed.transitions.map((t) => ({ id: t.id, name: t.name, enabled: t.enabled })),
      arcs: parsed.arcs.map((a) => ({ source: a.sourceName, target: a.targetName, weight: a.weight }))
    },
    null,
    2
  );
}

export function exportPnmlPlacesCsv(dataset: PnmlDataset): string {
  const lines = ['index,id,name,tokens,incoming,outgoing'];
  for (const p of dataset.places) {
    lines.push([p.index + 1, csv(p.id), csv(p.name), p.tokens, p.inCount, p.outCount].join(','));
  }
  return lines.join('\n');
}

export function exportPnmlArcsCsv(dataset: PnmlDataset): string {
  const lines = ['index,source,target,weight'];
  for (const a of dataset.arcs) {
    lines.push([a.index + 1, csv(a.sourceName), csv(a.targetName), a.weight].join(','));
  }
  return lines.join('\n');
}

export function resolvePnmlSuggestion(state: { hasFiles: boolean; hasError: boolean }): PnmlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order net PNML sample',
      reason: 'Load a local P/T net with places, transitions, tokens, and enabled firings.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PNML net',
      reason: 'Drop .pnml, XML, JSON, or CSV — or load the sample order fulfillment net.',
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
