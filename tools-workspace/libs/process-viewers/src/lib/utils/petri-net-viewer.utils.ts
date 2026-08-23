import { PETRI_NET_XML_SAMPLE } from '../constants/petri-net-sample.data';
import { PETRI_NET_MAX_FILE_BYTES, PETRI_NET_SUPPORTED_EXTENSIONS } from '../constants/petri-net-viewer.constants';
import type {
  PetriNetDataset,
  PetriNetLoadedFile,
  PetriNetMetadataRow,
  PetriNetPlace,
  PetriNetStep,
  PetriNetSuggestion,
  PetriNetTransition
} from '../types/petri-net-viewer.types';
import { parsePetriNetBytes } from './petri-net-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatPetriNetFileSize,
  readFileBytes as readPetriNetFileBytes
} from './process-file.utils';

export {
  enabledPetriNetIds,
  filterPetriNetPlaces,
  filterPetriNetTransitions,
  firePetriNetTransition,
  formatPetriNetMarking,
  initialPetriNetMarking,
  parsePetriNetBytes,
  parsePetriNetText,
  tokenTotal
} from './petri-net-parse.utils';
export {
  petriNetPlaceColor,
  petriNetTransitionColor,
  renderPetriNetGraph,
  renderPetriNetMarkings,
  renderPetriNetTrace
} from './petri-net-render.utils';

export function isSupportedPetriNetFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PETRI_NET_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validatePetriNetFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PETRI_NET_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(PETRI_NET_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPetriNetFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Petri net files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPetriNetFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pnml, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validatePetriNetFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePetriNetFile(): File {
  return new File([PETRI_NET_XML_SAMPLE], 'sample-vending-net.pnml', { type: 'application/xml', lastModified: 0 });
}

export function createPetriNetFileRecord(file: File, bytes: Uint8Array): PetriNetLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PetriNetDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePetriNetBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.places.length && !parsed.transitions.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Petri net');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPetriNet(file: PetriNetLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPetriNetMetadataRows(
  dataset: PetriNetDataset,
  marking: Record<string, number>,
  enabledCount: number,
  traceLength: number
): PetriNetMetadataRow[] {
  const tokens = Object.values(marking).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Net type', value: dataset.netType || '—' },
    { key: 'Places', value: String(dataset.places.length) },
    { key: 'Transitions', value: String(dataset.transitions.length) },
    { key: 'Arcs', value: String(dataset.arcs.length) },
    { key: 'Tokens now', value: String(tokens) },
    { key: 'Enabled', value: String(enabledCount) },
    { key: 'Trace steps', value: String(traceLength) }
  ];
}

export function buildPetriNetPlaceMetadata(place: PetriNetPlace, tokens: number): PetriNetMetadataRow[] {
  return [
    { key: 'ID', value: place.id },
    { key: 'Name', value: place.name },
    { key: 'Tokens now', value: String(tokens) },
    { key: 'Initial', value: String(place.initialTokens) },
    { key: 'Incoming', value: String(place.inCount) },
    { key: 'Outgoing', value: String(place.outCount) }
  ];
}

export function buildPetriNetTransitionMetadata(transition: PetriNetTransition, enabled: boolean): PetriNetMetadataRow[] {
  return [
    { key: 'ID', value: transition.id },
    { key: 'Name', value: transition.name },
    { key: 'Enabled', value: enabled ? 'yes' : 'no' },
    { key: 'Incoming', value: String(transition.inCount) },
    { key: 'Outgoing', value: String(transition.outCount) }
  ];
}

export function exportPetriNetSummaryJson(
  file: PetriNetLoadedFile,
  marking: Record<string, number>,
  trace: PetriNetStep[]
): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Petri net');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      netType: parsed.netType,
      marking,
      trace,
      places: parsed.places.map((p) => ({ id: p.id, name: p.name, initial: p.initialTokens, tokens: marking[p.id] ?? 0 })),
      transitions: parsed.transitions.map((t) => ({ id: t.id, name: t.name })),
      arcs: parsed.arcs.map((a) => ({ source: a.sourceName, target: a.targetName, weight: a.weight }))
    },
    null,
    2
  );
}

export function exportPetriNetMarkingCsv(dataset: PetriNetDataset, marking: Record<string, number>): string {
  const lines = ['index,id,name,initial,tokens'];
  for (const p of dataset.places) {
    lines.push([p.index + 1, csv(p.id), csv(p.name), p.initialTokens, marking[p.id] ?? 0].join(','));
  }
  return lines.join('\n');
}

export function exportPetriNetTraceCsv(trace: PetriNetStep[]): string {
  const lines = ['step,transition,marking'];
  for (const s of trace) {
    lines.push([s.step, csv(s.transitionName), csv(s.marking)].join(','));
  }
  return lines.join('\n');
}

export function resolvePetriNetSuggestion(state: { hasFiles: boolean; hasError: boolean }): PetriNetSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the vending machine Petri net',
      reason: 'Load a local P/T net and step token flow: insert coin → select → vend.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Petri net',
      reason: 'Drop .pnml, XML, JSON, or CSV — or load the sample vending machine and fire transitions.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function csv(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
