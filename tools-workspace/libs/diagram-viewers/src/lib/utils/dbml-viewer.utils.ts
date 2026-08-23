import { DBML_SAMPLE } from '../constants/dbml-viewer-sample.data';
import { DBML_MAX_FILE_BYTES, DBML_SUPPORTED_EXTENSIONS } from '../constants/dbml-viewer.constants';
import type {
  DbmlDataset,
  DbmlLoadedFile,
  DbmlMetadataRow,
  DbmlRef,
  DbmlSuggestion,
  DbmlTable
} from '../types/dbml-viewer.types';
import { parseDbmlBytes } from './dbml-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatDbmlFileSize,
  readFileBytes as readDbmlFileBytes
} from './diagram-file.utils';

export { filterDbmlRefs, filterDbmlTables, parseDbmlBytes, parseDbmlText } from './dbml-viewer-parse.utils';
export { dbmlTableColor, renderDbmlDiagram, renderDbmlRefs, renderDbmlTables } from './dbml-viewer-render.utils';

export function isSupportedDbmlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DBML_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateDbmlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DBML_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(DBML_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDbmlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed DBML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDbmlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .dbml, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateDbmlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDbmlFile(): File {
  return new File([DBML_SAMPLE], 'sample-shop.dbml', { type: 'text/plain', lastModified: 0 });
}

export function createDbmlFileRecord(file: File, bytes: Uint8Array): DbmlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DbmlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDbmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DBML');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDbml(file: DbmlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDbmlMetadataRows(dataset: DbmlDataset): DbmlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Database', value: dataset.databaseType || '—' },
    { key: 'Tables', value: String(dataset.tables.length) },
    { key: 'Refs', value: String(dataset.refs.length) }
  ];
}

export function buildDbmlTableMetadata(table: DbmlTable): DbmlMetadataRow[] {
  return [
    { key: 'Id', value: table.id },
    { key: 'Name', value: table.name },
    { key: 'Alias', value: table.alias || '—' },
    { key: 'Note', value: table.note || '—' },
    { key: 'Columns', value: String(table.columns.length) },
    { key: 'PK', value: table.columns.filter((c) => c.pk).map((c) => c.name).join(', ') || '—' },
    { key: 'FK', value: table.columns.filter((c) => c.fk).map((c) => c.name).join(', ') || '—' }
  ];
}

export function buildDbmlRefMetadata(ref: DbmlRef): DbmlMetadataRow[] {
  return [
    { key: 'Name', value: ref.name || '—' },
    { key: 'From', value: `${ref.sourceName}.${ref.sourceColumn}` },
    { key: 'To', value: `${ref.targetName}.${ref.targetColumn}` },
    { key: 'Rel', value: ref.rel }
  ];
}

export function exportDbmlSummaryJson(file: DbmlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DBML');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      databaseType: parsed.databaseType,
      tables: parsed.tables.map((t) => ({
        id: t.id,
        name: t.name,
        alias: t.alias,
        note: t.note,
        columns: t.columns
      })),
      refs: parsed.refs.map((r) => ({
        name: r.name,
        source: r.source,
        target: r.target,
        sourceColumn: r.sourceColumn,
        targetColumn: r.targetColumn,
        rel: r.rel
      }))
    },
    null,
    2
  );
}

export function exportDbmlTablesCsv(dataset: DbmlDataset): string {
  const lines = ['index,id,name,columns,pk,fk'];
  for (const t of dataset.tables) {
    lines.push(
      [
        t.index + 1,
        csv(t.id),
        csv(t.name),
        t.columns.length,
        csv(t.columns.filter((c) => c.pk).map((c) => c.name).join('|')),
        csv(t.columns.filter((c) => c.fk).map((c) => c.name).join('|'))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportDbmlRefsCsv(dataset: DbmlDataset): string {
  const lines = ['index,source,target,source_column,target_column,rel'];
  for (const r of dataset.refs) {
    lines.push([r.index + 1, csv(r.source), csv(r.target), csv(r.sourceColumn), csv(r.targetColumn), csv(String(r.rel))].join(','));
  }
  return lines.join('\n');
}

export function resolveDbmlSuggestion(state: { hasFiles: boolean; hasError: boolean }): DbmlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop DBML sample',
      reason: 'Load a local table-and-ref view of Customer, Order, and Product.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DBML schema',
      reason: 'Drop .dbml, JSON, or XML — or load the sample shop schema.',
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
