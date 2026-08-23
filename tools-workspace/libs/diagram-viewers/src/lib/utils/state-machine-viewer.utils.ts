import { SM_SAMPLE } from '../constants/state-machine-viewer-sample.data';
import { SM_MAX_FILE_BYTES, SM_SUPPORTED_EXTENSIONS } from '../constants/state-machine-viewer.constants';
import type { SmDataset, SmLoadedFile, SmMetadataRow, SmState, SmSuggestion, SmTransition } from '../types/state-machine-viewer.types';
import { parseStateMachineBytes } from './state-machine-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatSmFileSize,
  readFileBytes as readSmFileBytes
} from './diagram-file.utils';

export {
  filterSmStates,
  filterSmTransitions,
  parseStateMachineBytes,
  parseStateMachineText
} from './state-machine-viewer-parse.utils';
export { renderSmDiagram, renderSmStates, renderSmTransitions, smStateColor } from './state-machine-viewer-render.utils';

export function isSupportedSmFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateSmFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SM_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(SM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSmFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed state machine files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSmFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .scxml, .fsm, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateSmFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSmFile(): File {
  return new File([SM_SAMPLE], 'sample-shop.scxml', { type: 'application/scxml+xml', lastModified: 0 });
}

export function createSmFileRecord(file: File, bytes: Uint8Array): SmLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SmDataset | null = null;
  let softFail = false;
  try {
    parsed = parseStateMachineBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.states.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse state machine');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSm(file: SmLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSmMetadataRows(dataset: SmDataset): SmMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Initial', value: dataset.initial || '—' },
    { key: 'States', value: String(dataset.states.length) },
    { key: 'Transitions', value: String(dataset.transitions.length) }
  ];
}

export function buildSmStateMetadata(state: SmState): SmMetadataRow[] {
  return [
    { key: 'Id', value: state.id },
    { key: 'Name', value: state.name },
    { key: 'Kind', value: state.kind }
  ];
}

export function buildSmTransitionMetadata(transition: SmTransition): SmMetadataRow[] {
  return [
    { key: 'From', value: transition.sourceName || transition.source },
    { key: 'Event', value: transition.event || '—' },
    { key: 'To', value: transition.targetName || transition.target },
    { key: 'Cond', value: transition.cond || '—' }
  ];
}

export function exportSmSummaryJson(file: SmLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed state machine');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      initial: parsed.initial,
      states: parsed.states.map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
      transitions: parsed.transitions.map((t) => ({ source: t.source, target: t.target, event: t.event, cond: t.cond }))
    },
    null,
    2
  );
}

export function exportSmStatesCsv(dataset: SmDataset): string {
  const lines = ['index,id,name,kind'];
  for (const s of dataset.states) {
    lines.push([s.index + 1, csv(s.id), csv(s.name), s.kind].join(','));
  }
  return lines.join('\n');
}

export function exportSmTransitionsCsv(dataset: SmDataset): string {
  const lines = ['index,source,event,target,cond'];
  for (const t of dataset.transitions) {
    lines.push([t.index + 1, csv(t.sourceName), csv(t.event), csv(t.targetName), csv(t.cond)].join(','));
  }
  return lines.join('\n');
}

export function resolveSmSuggestion(state: { hasFiles: boolean; hasError: boolean }): SmSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop checkout sample',
      reason: 'Load a local SCXML checkout machine with idle → cart → payment.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a state machine',
      reason: 'Drop SCXML, FSM JSON, or Markdown — or load the sample checkout machine.',
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
