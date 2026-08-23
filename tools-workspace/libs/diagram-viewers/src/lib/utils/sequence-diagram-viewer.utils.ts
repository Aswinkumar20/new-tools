import { SEQ_PUML_SAMPLE } from '../constants/sequence-diagram-viewer-sample.data';
import { SEQ_MAX_FILE_BYTES, SEQ_SUPPORTED_EXTENSIONS } from '../constants/sequence-diagram-viewer.constants';
import type {
  SeqDataset,
  SeqLifeline,
  SeqLoadedFile,
  SeqMessage,
  SeqMetadataRow,
  SeqSuggestion
} from '../types/sequence-diagram-viewer.types';
import { parseSequenceBytes } from './sequence-diagram-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatSeqFileSize,
  readFileBytes as readSeqFileBytes
} from './diagram-file.utils';

export { filterSeqLifelines, filterSeqMessages, parseSequenceBytes, parseSequenceText } from './sequence-diagram-viewer-parse.utils';
export { renderSeqDiagram, renderSeqLifelines, renderSeqMessages, seqLifelineColor } from './sequence-diagram-viewer-render.utils';

export function isSupportedSeqFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SEQ_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateSeqFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SEQ_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(SEQ_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSeqFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed sequence files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSeqFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .puml, .uml, .seq, .sd, .mmd, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateSeqFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSeqFile(): File {
  return new File([SEQ_PUML_SAMPLE], 'sample-checkout-seq.puml', { type: 'text/plain', lastModified: 0 });
}

export function createSeqFileRecord(file: File, bytes: Uint8Array): SeqLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SeqDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSequenceBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.lifelines.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse sequence diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSeq(file: SeqLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSeqMetadataRows(dataset: SeqDataset): SeqMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Lifelines', value: String(dataset.lifelines.length) },
    { key: 'Messages', value: String(dataset.messages.length) }
  ];
}

export function buildSeqLifelineMetadata(line: SeqLifeline): SeqMetadataRow[] {
  return [
    { key: 'Id', value: line.id },
    { key: 'Name', value: line.name },
    { key: 'Kind', value: line.kind },
    { key: 'Alias', value: line.alias || '—' }
  ];
}

export function buildSeqMessageMetadata(message: SeqMessage): SeqMetadataRow[] {
  return [
    { key: 'From', value: message.sourceName || message.source },
    { key: 'To', value: message.targetName || message.target },
    { key: 'Label', value: message.label || '—' },
    { key: 'Style', value: message.style }
  ];
}

export function exportSeqSummaryJson(file: SeqLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed sequence diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      lifelines: parsed.lifelines.map((l) => ({ id: l.id, name: l.name, kind: l.kind })),
      messages: parsed.messages.map((m) => ({
        source: m.source,
        target: m.target,
        label: m.label,
        style: m.style
      }))
    },
    null,
    2
  );
}

export function exportSeqLifelinesCsv(dataset: SeqDataset): string {
  const lines = ['index,id,name,kind,alias'];
  for (const l of dataset.lifelines) {
    lines.push([l.index + 1, csv(l.id), csv(l.name), l.kind, csv(l.alias)].join(','));
  }
  return lines.join('\n');
}

export function exportSeqMessagesCsv(dataset: SeqDataset): string {
  const lines = ['index,source,target,label,style'];
  for (const m of dataset.messages) {
    lines.push([m.index + 1, csv(m.source), csv(m.target), csv(m.label), m.style].join(','));
  }
  return lines.join('\n');
}

export function resolveSeqSuggestion(state: { hasFiles: boolean; hasError: boolean }): SeqSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the checkout sequence sample',
      reason: 'Load a local interaction with User, Shop, and Pay lifelines.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a sequence diagram',
      reason: 'Drop .puml, Mermaid, JSON, or XML — or load the sample checkout interaction.',
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
