import { SQ_MAX_FILE_BYTES, SQ_SUPPORTED_EXTENSIONS } from '../constants/sqlite-viewer.constants';
import type { SqColumn, SqDataset, SqLoadedFile, SqMetadataRow, SqSuggestion, SqTable } from '../types/sqlite-viewer.types';
import { buildSampleSqliteBytes, parseSqliteBytes } from './sqlite-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatSqFileSize,
  readFileBytes as readSqFileBytes
} from './data-file.utils';

export {
  buildSampleSqliteBytes,
  filterSqColumns,
  filterSqRows,
  filterSqTables,
  parseSqliteBytes,
  parseSqliteText
} from './sqlite-viewer-parse.utils';
export { renderSqPreview, renderSqSchema, renderSqTables, sqColumnColor } from './sqlite-viewer-render.utils';

export function isSupportedSqFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SQ_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateSqFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SQ_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(SQ_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSqFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SQLite files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSqFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .sqlite, .db, .sql, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateSqFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSqFile(): File {
  return new File([dataBytesToBlobPart(buildSampleSqliteBytes())], 'library.sqlite', { type: 'application/vnd.sqlite3', lastModified: 0 });
}

export function createSqFileRecord(file: File, bytes: Uint8Array): SqLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SqDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSqliteBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SQLite');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSq(file: SqLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSqMetadataRows(dataset: SqDataset): SqMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Page size', value: dataset.pageSize ? String(dataset.pageSize) : '—' },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Pages', value: dataset.pageCount ? String(dataset.pageCount) : '—' },
    { key: 'Tables', value: String(dataset.tables.length) }
  ];
}

export function buildSqTableMetadata(table: SqTable): SqMetadataRow[] {
  return [
    { key: 'Name', value: table.name },
    { key: 'Columns', value: String(table.columns.length) },
    { key: 'Rows', value: String(table.numRows || table.rows.length) },
    { key: 'SQL', value: table.sql || '—' }
  ];
}

export function buildSqColumnMetadata(column: SqColumn): SqMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Nullable', value: column.nullable ? 'yes' : 'no' },
    { key: 'PK', value: column.pk ? 'yes' : 'no' }
  ];
}

export function exportSqSummaryJson(file: SqLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SQLite database');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      pageSize: parsed.pageSize,
      encoding: parsed.encoding,
      tables: parsed.tables.map((t) => ({
        name: t.name,
        sql: t.sql,
        numRows: t.numRows,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, pk: c.pk })),
        rows: t.rows
      }))
    },
    null,
    2
  );
}

export function exportSqSchemaCsv(dataset: SqDataset): string {
  const lines = ['table,index,name,type,nullable,pk'];
  for (const t of dataset.tables) {
    for (const c of t.columns) {
      lines.push([csv(t.name), c.index + 1, csv(c.name), csv(c.type), c.nullable ? 'yes' : 'no', c.pk ? 'yes' : 'no'].join(','));
    }
  }
  return lines.join('\n');
}

export function exportSqRowsCsv(table: SqTable): string {
  const header = table.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of table.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveSqSuggestion(state: { hasFiles: boolean; hasError: boolean }): SqSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the library sample',
      reason: 'Load a local SQLite database with orders and products tables.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SQLite database',
      reason: 'Drop a .sqlite / .db file, SQL dump, or CSV — or load the library sample.',
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
