import { ER_PUML_SAMPLE } from '../constants/er-diagram-viewer-sample.data';
import { ER_MAX_FILE_BYTES, ER_SUPPORTED_EXTENSIONS } from '../constants/er-diagram-viewer.constants';
import type {
  ErDataset,
  ErEntity,
  ErKey,
  ErLoadedFile,
  ErMetadataRow,
  ErRelation,
  ErSuggestion
} from '../types/er-diagram-viewer.types';
import { parseErDiagramBytes } from './er-diagram-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatErFileSize,
  readFileBytes as readErFileBytes
} from './diagram-file.utils';

export {
  filterErEntities,
  filterErKeys,
  filterErRelations,
  parseErDiagramBytes,
  parseErDiagramText
} from './er-diagram-viewer-parse.utils';
export {
  erEntityColor,
  erKeyColor,
  renderErDiagram,
  renderErEntities,
  renderErKeys,
  renderErRelations
} from './er-diagram-viewer-render.utils';

export function isSupportedErFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (ER_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateErFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ER_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(ER_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidErFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed ER files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedErFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .puml, .erd, .mmd, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateErFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleErFile(): File {
  return new File([ER_PUML_SAMPLE], 'sample-shop-er.puml', { type: 'text/plain', lastModified: 0 });
}

export function createErFileRecord(file: File, bytes: Uint8Array): ErLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ErDataset | null = null;
  let softFail = false;
  try {
    parsed = parseErDiagramBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse ER diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportEr(file: ErLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildErMetadataRows(dataset: ErDataset): ErMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Entities', value: String(dataset.entities.length) },
    { key: 'Keys', value: String(dataset.keys.length) },
    { key: 'Relations', value: String(dataset.relations.length) }
  ];
}

export function buildErEntityMetadata(entity: ErEntity): ErMetadataRow[] {
  return [
    { key: 'Id', value: entity.id },
    { key: 'Name', value: entity.name },
    { key: 'Stereotype', value: entity.stereotype || '—' },
    { key: 'Columns', value: String(entity.columns.length) },
    { key: 'PK', value: entity.columns.filter((c) => c.pk).map((c) => c.name).join(', ') || '—' },
    { key: 'FK', value: entity.columns.filter((c) => c.fk).map((c) => c.name).join(', ') || '—' }
  ];
}

export function buildErKeyMetadata(key: ErKey): ErMetadataRow[] {
  return [
    { key: 'Entity', value: key.entityName },
    { key: 'Column', value: key.column },
    { key: 'Type', value: key.type || '—' },
    { key: 'Kind', value: key.kind.toUpperCase() },
    { key: 'References', value: key.refEntity ? `${key.refEntity}.${key.refColumn || 'id'}` : '—' }
  ];
}

export function buildErRelationMetadata(relation: ErRelation): ErMetadataRow[] {
  return [
    { key: 'From', value: relation.sourceName || relation.source },
    { key: 'To', value: relation.targetName || relation.target },
    { key: 'Label', value: relation.label || '—' },
    { key: 'Cardinality', value: `${relation.sourceCard || '—'} … ${relation.targetCard || '—'}` }
  ];
}

export function exportErSummaryJson(file: ErLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ER diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      entities: parsed.entities.map((e) => ({
        id: e.id,
        name: e.name,
        stereotype: e.stereotype,
        columns: e.columns
      })),
      relations: parsed.relations.map((r) => ({
        source: r.source,
        target: r.target,
        label: r.label,
        sourceCard: r.sourceCard,
        targetCard: r.targetCard
      })),
      keys: parsed.keys.map((k) => ({
        entity: k.entityName,
        column: k.column,
        kind: k.kind,
        refEntity: k.refEntity,
        refColumn: k.refColumn
      }))
    },
    null,
    2
  );
}

export function exportErEntitiesCsv(dataset: ErDataset): string {
  const lines = ['index,id,name,columns,pk,fk'];
  for (const e of dataset.entities) {
    lines.push(
      [
        e.index + 1,
        csv(e.id),
        csv(e.name),
        e.columns.length,
        csv(e.columns.filter((c) => c.pk).map((c) => c.name).join('|')),
        csv(e.columns.filter((c) => c.fk).map((c) => c.name).join('|'))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportErKeysCsv(dataset: ErDataset): string {
  const lines = ['index,entity,column,type,kind,ref_entity,ref_column'];
  for (const k of dataset.keys) {
    lines.push([k.index + 1, csv(k.entityName), csv(k.column), csv(k.type), k.kind, csv(k.refEntity), csv(k.refColumn)].join(','));
  }
  return lines.join('\n');
}

export function resolveErSuggestion(state: { hasFiles: boolean; hasError: boolean }): ErSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop ER sample',
      reason: 'Load a local entity-and-key view of Customer, Order, and Product.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an ER diagram',
      reason: 'Drop PlantUML, Mermaid erDiagram, JSON, or XML — or load the sample shop ER.',
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
