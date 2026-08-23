import { PUML_CLASS_SAMPLE } from '../constants/plantuml-viewer-sample.data';
import { PUML_MAX_FILE_BYTES, PUML_SUPPORTED_EXTENSIONS } from '../constants/plantuml-viewer.constants';
import type {
  PumlDataset,
  PumlElement,
  PumlLoadedFile,
  PumlMetadataRow,
  PumlRelation,
  PumlSuggestion
} from '../types/plantuml-viewer.types';
import { parsePlantUmlBytes } from './plantuml-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatPumlFileSize,
  readFileBytes as readPumlFileBytes
} from './diagram-file.utils';

export { filterPumlElements, filterPumlRelations, parsePlantUmlBytes, parsePlantUmlText } from './plantuml-viewer-parse.utils';
export { pumlElementColor, renderPumlDiagram, renderPumlElements, renderPumlRelations } from './plantuml-viewer-render.utils';

export function isSupportedPumlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PUML_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validatePumlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PUML_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(PUML_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPumlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed PlantUML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPumlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .puml, .plantuml, .pu, .md, .txt, or .json)' });
      continue;
    }
    const sizeError = validatePumlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePumlFile(): File {
  return new File([PUML_CLASS_SAMPLE], 'sample-shop-classes.puml', { type: 'text/plain', lastModified: 0 });
}

export function createPumlFileRecord(file: File, bytes: Uint8Array): PumlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PumlDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePlantUmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.elements.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PlantUML diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPuml(file: PumlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPumlMetadataRows(dataset: PumlDataset): PumlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Kind', value: dataset.kind },
    { key: 'Elements', value: String(dataset.elements.length) },
    { key: 'Relations', value: String(dataset.relations.length) }
  ];
}

export function buildPumlElementMetadata(element: PumlElement): PumlMetadataRow[] {
  return [
    { key: 'Id', value: element.id },
    { key: 'Name', value: element.name },
    { key: 'Kind', value: element.kind },
    { key: 'Stereotype', value: element.stereotype || '—' },
    { key: 'Members', value: element.members.length ? element.members.join(', ') : '—' }
  ];
}

export function buildPumlRelationMetadata(relation: PumlRelation): PumlMetadataRow[] {
  return [
    { key: 'From', value: `${relation.sourceName}${relation.sourceCard ? ` (${relation.sourceCard})` : ''}` },
    { key: 'To', value: `${relation.targetName}${relation.targetCard ? ` (${relation.targetCard})` : ''}` },
    { key: 'Label', value: relation.label || '—' },
    { key: 'Style', value: relation.style }
  ];
}

export function exportPumlSummaryJson(file: PumlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PlantUML diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      kind: parsed.kind,
      title: parsed.title,
      elements: parsed.elements.map((e) => ({ id: e.id, name: e.name, kind: e.kind, stereotype: e.stereotype, members: e.members })),
      relations: parsed.relations.map((r) => ({ source: r.source, target: r.target, label: r.label, style: r.style }))
    },
    null,
    2
  );
}

export function exportPumlElementsCsv(dataset: PumlDataset): string {
  const lines = ['index,id,name,kind,stereotype,members'];
  for (const e of dataset.elements) {
    lines.push([e.index + 1, csv(e.id), csv(e.name), e.kind, csv(e.stereotype), csv(e.members.join('|'))].join(','));
  }
  return lines.join('\n');
}

export function exportPumlRelationsCsv(dataset: PumlDataset): string {
  const lines = ['index,source,target,label,style,source_card,target_card'];
  for (const r of dataset.relations) {
    lines.push([r.index + 1, csv(r.source), csv(r.target), csv(r.label), r.style, csv(r.sourceCard), csv(r.targetCard)].join(','));
  }
  return lines.join('\n');
}

export function resolvePumlSuggestion(state: { hasFiles: boolean; hasError: boolean }): PumlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop class sample',
      reason: 'Load a local PlantUML class diagram with composition and realization.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PlantUML diagram',
      reason: 'Drop .puml, Markdown, or JSON — or load the sample shop classes.',
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
