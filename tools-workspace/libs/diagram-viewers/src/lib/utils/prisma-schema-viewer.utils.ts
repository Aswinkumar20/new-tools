import { PRM_SAMPLE } from '../constants/prisma-schema-viewer-sample.data';
import { PRM_MAX_FILE_BYTES, PRM_SUPPORTED_EXTENSIONS } from '../constants/prisma-schema-viewer.constants';
import type {
  PrmDataset,
  PrmLoadedFile,
  PrmMetadataRow,
  PrmModel,
  PrmRelation,
  PrmSuggestion
} from '../types/prisma-schema-viewer.types';
import { parsePrismaSchemaBytes } from './prisma-schema-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatPrmFileSize,
  readFileBytes as readPrmFileBytes
} from './diagram-file.utils';

export {
  filterPrmModels,
  filterPrmRelations,
  parsePrismaSchemaBytes,
  parsePrismaSchemaText
} from './prisma-schema-viewer-parse.utils';
export { prmModelColor, renderPrmDiagram, renderPrmModels, renderPrmRelations } from './prisma-schema-viewer-render.utils';

export function isSupportedPrmFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PRM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validatePrmFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PRM_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(PRM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPrmFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Prisma files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPrmFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .prisma, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validatePrmFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePrmFile(): File {
  return new File([PRM_SAMPLE], 'sample-shop.prisma', { type: 'text/plain', lastModified: 0 });
}

export function createPrmFileRecord(file: File, bytes: Uint8Array): PrmLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PrmDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePrismaSchemaBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.models.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Prisma schema');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPrm(file: PrmLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPrmMetadataRows(dataset: PrmDataset): PrmMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Provider', value: dataset.provider || '—' },
    { key: 'Models', value: String(dataset.models.length) },
    { key: 'Relations', value: String(dataset.relations.length) }
  ];
}

export function buildPrmModelMetadata(model: PrmModel): PrmMetadataRow[] {
  return [
    { key: 'Id', value: model.id },
    { key: 'Name', value: model.name },
    { key: 'Kind', value: model.kind },
    { key: 'Fields', value: String(model.fields.length) },
    { key: 'IDs', value: model.fields.filter((f) => f.isId).map((f) => f.name).join(', ') || '—' },
    { key: 'Uniques', value: model.fields.filter((f) => f.isUnique).map((f) => f.name).join(', ') || '—' }
  ];
}

export function buildPrmRelationMetadata(rel: PrmRelation): PrmMetadataRow[] {
  return [
    { key: 'Name', value: rel.name || '—' },
    { key: 'From', value: `${rel.sourceName}.${rel.sourceField}` },
    { key: 'To', value: `${rel.targetName}.${rel.targetField}` },
    { key: 'Kind', value: rel.kind }
  ];
}

export function exportPrmSummaryJson(file: PrmLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Prisma schema');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      provider: parsed.provider,
      models: parsed.models.map((m) => ({ id: m.id, name: m.name, kind: m.kind, fields: m.fields })),
      relations: parsed.relations.map((r) => ({
        name: r.name,
        source: r.source,
        target: r.target,
        sourceField: r.sourceField,
        targetField: r.targetField,
        kind: r.kind
      }))
    },
    null,
    2
  );
}

export function exportPrmModelsCsv(dataset: PrmDataset): string {
  const lines = ['index,id,name,kind,fields,ids'];
  for (const m of dataset.models) {
    lines.push(
      [
        m.index + 1,
        csv(m.id),
        csv(m.name),
        m.kind,
        m.fields.length,
        csv(m.fields.filter((f) => f.isId).map((f) => f.name).join('|'))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportPrmRelationsCsv(dataset: PrmDataset): string {
  const lines = ['index,source,target,source_field,target_field,kind'];
  for (const r of dataset.relations) {
    lines.push([r.index + 1, csv(r.source), csv(r.target), csv(r.sourceField), csv(r.targetField), r.kind].join(','));
  }
  return lines.join('\n');
}

export function resolvePrmSuggestion(state: { hasFiles: boolean; hasError: boolean }): PrmSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop Prisma sample',
      reason: 'Load a local model-and-relation view of Customer, Order, Product, and OrderItem.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Prisma schema',
      reason: 'Drop schema.prisma, JSON, or XML — or load the sample shop schema.',
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
