import { C4_PUML_SAMPLE } from '../constants/c4-model-viewer-sample.data';
import { C4_MAX_FILE_BYTES, C4_SUPPORTED_EXTENSIONS } from '../constants/c4-model-viewer.constants';
import type {
  C4Dataset,
  C4Element,
  C4LoadedFile,
  C4MetadataRow,
  C4Relation,
  C4Suggestion
} from '../types/c4-model-viewer.types';
import { parseC4Bytes } from './c4-model-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatC4FileSize,
  readFileBytes as readC4FileBytes
} from './diagram-file.utils';

export { filterC4Elements, filterC4Relations, parseC4Bytes, parseC4Text } from './c4-model-viewer-parse.utils';
export { c4ElementColor, renderC4Diagram, renderC4Elements, renderC4Relations } from './c4-model-viewer-render.utils';

export function isSupportedC4File(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (C4_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateC4FileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > C4_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(C4_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidC4Files(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed C4 files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedC4File(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .puml, .c4, .dsl, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateC4FileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleC4File(): File {
  return new File([C4_PUML_SAMPLE], 'sample-shop-c4.puml', { type: 'text/plain', lastModified: 0 });
}

export function createC4FileRecord(file: File, bytes: Uint8Array): C4LoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: C4Dataset | null = null;
  let softFail = false;
  try {
    parsed = parseC4Bytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.elements.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse C4 model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportC4(file: C4LoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildC4MetadataRows(dataset: C4Dataset): C4MetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Level', value: dataset.level },
    { key: 'Context', value: String(dataset.elements.filter((e) => e.kind === 'person' || e.kind === 'system' || e.kind === 'boundary').length) },
    { key: 'Containers', value: String(dataset.elements.filter((e) => e.kind === 'container').length) },
    { key: 'Components', value: String(dataset.elements.filter((e) => e.kind === 'component').length) },
    { key: 'Relations', value: String(dataset.relations.length) }
  ];
}

export function buildC4ElementMetadata(element: C4Element): C4MetadataRow[] {
  return [
    { key: 'Id', value: element.id },
    { key: 'Name', value: element.name },
    { key: 'Kind', value: element.kind },
    { key: 'Stereotype', value: element.stereotype || '—' },
    { key: 'Technology', value: element.technology || '—' },
    { key: 'Parent', value: element.parent || '—' },
    { key: 'Description', value: element.description || '—' }
  ];
}

export function buildC4RelationMetadata(relation: C4Relation): C4MetadataRow[] {
  return [
    { key: 'From', value: relation.sourceName || relation.source },
    { key: 'To', value: relation.targetName || relation.target },
    { key: 'Label', value: relation.label || '—' },
    { key: 'Technology', value: relation.technology || '—' }
  ];
}

export function exportC4SummaryJson(file: C4LoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed C4 model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      level: parsed.level,
      elements: parsed.elements.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        stereotype: e.stereotype,
        technology: e.technology,
        parent: e.parent
      })),
      relations: parsed.relations.map((r) => ({
        source: r.source,
        target: r.target,
        label: r.label,
        technology: r.technology
      }))
    },
    null,
    2
  );
}

export function exportC4ElementsCsv(dataset: C4Dataset): string {
  const lines = ['index,id,name,kind,stereotype,technology,parent'];
  for (const e of dataset.elements) {
    lines.push([e.index + 1, csv(e.id), csv(e.name), e.kind, csv(e.stereotype), csv(e.technology), csv(e.parent)].join(','));
  }
  return lines.join('\n');
}

export function exportC4RelationsCsv(dataset: C4Dataset): string {
  const lines = ['index,source,target,label,technology'];
  for (const r of dataset.relations) {
    lines.push([r.index + 1, csv(r.source), csv(r.target), csv(r.label), csv(r.technology)].join(','));
  }
  return lines.join('\n');
}

export function resolveC4Suggestion(state: { hasFiles: boolean; hasError: boolean }): C4Suggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop C4 sample',
      reason: 'Load a local context/container/component model of the shop.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a C4 model',
      reason: 'Drop .puml, Structurizr DSL, JSON, or XML — or load the sample shop C4.',
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
