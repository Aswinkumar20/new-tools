import { CDG_PUML_SAMPLE } from '../constants/class-diagram-viewer-sample.data';
import { CDG_MAX_FILE_BYTES, CDG_SUPPORTED_EXTENSIONS } from '../constants/class-diagram-viewer.constants';
import type {
  CdgDataset,
  CdgLoadedFile,
  CdgMetadataRow,
  CdgRelation,
  CdgSuggestion,
  CdgType
} from '../types/class-diagram-viewer.types';
import { parseClassDiagramBytes } from './class-diagram-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatCdgFileSize,
  readFileBytes as readCdgFileBytes
} from './diagram-file.utils';

export {
  filterCdgRelations,
  filterCdgTypes,
  parseClassDiagramBytes,
  parseClassDiagramText
} from './class-diagram-viewer-parse.utils';
export { cdgTypeColor, renderCdgDiagram, renderCdgRelations, renderCdgTypes } from './class-diagram-viewer-render.utils';

export function isSupportedCdgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (CDG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateCdgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > CDG_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(CDG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidCdgFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed class diagram files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedCdgFile(file)) {
      rejected.push({
        name: file.name,
        reason: 'Unsupported format (use .puml, .uml, .cdm, .cls, .xmi, .xml, .md, .txt, or .json)'
      });
      continue;
    }
    const sizeError = validateCdgFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleCdgFile(): File {
  return new File([CDG_PUML_SAMPLE], 'sample-catalog-types.puml', { type: 'text/plain', lastModified: 0 });
}

export function createCdgFileRecord(file: File, bytes: Uint8Array): CdgLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: CdgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseClassDiagramBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.types.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse class diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportCdg(file: CdgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildCdgMetadataRows(dataset: CdgDataset): CdgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Types', value: String(dataset.types.length) },
    { key: 'Relations', value: String(dataset.relations.length) },
    { key: 'Attributes', value: String(dataset.types.reduce((n, t) => n + t.attributes.length, 0)) },
    { key: 'Operations', value: String(dataset.types.reduce((n, t) => n + t.operations.length, 0)) }
  ];
}

export function buildCdgTypeMetadata(type: CdgType): CdgMetadataRow[] {
  return [
    { key: 'Id', value: type.id },
    { key: 'Name', value: type.name },
    { key: 'Kind', value: type.kind },
    { key: 'Stereotype', value: type.stereotype || '—' },
    { key: 'Attributes', value: type.attributes.length ? type.attributes.map((m) => `${m.visibility[0]}${m.name}${m.type ? `: ${m.type}` : ''}`).join(', ') : '—' },
    { key: 'Operations', value: type.operations.length ? type.operations.map((m) => `${m.name}()${m.type ? `: ${m.type}` : ''}`).join(', ') : '—' }
  ];
}

export function buildCdgRelationMetadata(relation: CdgRelation): CdgMetadataRow[] {
  return [
    { key: 'From', value: `${relation.sourceName}${relation.sourceCard ? ` (${relation.sourceCard})` : ''}` },
    { key: 'To', value: `${relation.targetName}${relation.targetCard ? ` (${relation.targetCard})` : ''}` },
    { key: 'Label', value: relation.label || '—' },
    { key: 'Style', value: relation.style }
  ];
}

export function exportCdgSummaryJson(file: CdgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed class diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      types: parsed.types.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        stereotype: t.stereotype,
        attributes: t.attributes,
        operations: t.operations
      })),
      relations: parsed.relations.map((r) => ({
        source: r.source,
        target: r.target,
        label: r.label,
        style: r.style,
        sourceCard: r.sourceCard,
        targetCard: r.targetCard
      }))
    },
    null,
    2
  );
}

export function exportCdgTypesCsv(dataset: CdgDataset): string {
  const lines = ['index,id,name,kind,stereotype,attributes,operations'];
  for (const t of dataset.types) {
    lines.push(
      [
        t.index + 1,
        csv(t.id),
        csv(t.name),
        t.kind,
        csv(t.stereotype),
        csv(t.attributes.map((m) => m.name).join('|')),
        csv(t.operations.map((m) => m.name).join('|'))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportCdgRelationsCsv(dataset: CdgDataset): string {
  const lines = ['index,source,target,label,style,source_card,target_card'];
  for (const r of dataset.relations) {
    lines.push(
      [r.index + 1, csv(r.source), csv(r.target), csv(r.label), r.style, csv(r.sourceCard), csv(r.targetCard)].join(',')
    );
  }
  return lines.join('\n');
}

export function resolveCdgSuggestion(state: { hasFiles: boolean; hasError: boolean }): CdgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the catalog types sample',
      reason: 'Load a local class model with abstract, interface, enum, and relations.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a class diagram',
      reason: 'Drop .puml, .uml, XMI, Markdown, or JSON — or load the sample catalog types.',
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
