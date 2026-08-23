import { DK_MAX_FILE_BYTES, DK_SUPPORTED_EXTENSIONS } from '../constants/duckdb-viewer.constants';
import type { DkColumn, DkDataset, DkLoadedFile, DkMetadataRow, DkSuggestion, DkTable } from '../types/duckdb-viewer.types';
import { buildSampleDuckdbBytes, parseDuckdbBytes } from './duckdb-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatDkFileSize,
  readFileBytes as readDkFileBytes
} from './data-file.utils';

export {
  buildSampleDuckdbBytes,
  filterDkColumns,
  filterDkRows,
  filterDkTables,
  parseDuckdbBytes,
  parseDuckdbText
} from './duckdb-viewer-parse.utils';
export { dkColumnColor, renderDkPreview, renderDkSchema, renderDkTables } from './duckdb-viewer-render.utils';

export function isSupportedDkFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DK_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateDkFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DK_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(DK_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDkFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed DuckDB files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDkFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .duckdb, .ddb, .sql, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDkFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDkFile(): File {
  return new File([dataBytesToBlobPart(buildSampleDuckdbBytes())], 'analytics.duckdb', { type: 'application/octet-stream', lastModified: 0 });
}

export function createDkFileRecord(file: File, bytes: Uint8Array): DkLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DkDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDuckdbBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DuckDB');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDk(file: DkLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDkMetadataRows(dataset: DkDataset): DkMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Storage', value: dataset.storageVersion || '—' },
    { key: 'Tables', value: String(dataset.tables.length) }
  ];
}

export function buildDkTableMetadata(table: DkTable): DkMetadataRow[] {
  return [
    { key: 'Name', value: table.name },
    { key: 'Columns', value: String(table.columns.length) },
    { key: 'Rows', value: String(table.numRows || table.rows.length) },
    { key: 'SQL', value: table.sql || '—' }
  ];
}

export function buildDkColumnMetadata(column: DkColumn): DkMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Nullable', value: column.nullable ? 'yes' : 'no' }
  ];
}

export function exportDkSummaryJson(file: DkLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DuckDB database');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      storageVersion: parsed.storageVersion,
      tables: parsed.tables.map((t) => ({
        name: t.name,
        sql: t.sql,
        numRows: t.numRows,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
        rows: t.rows
      }))
    },
    null,
    2
  );
}

export function exportDkSchemaCsv(dataset: DkDataset): string {
  const lines = ['table,index,name,type,nullable'];
  for (const t of dataset.tables) {
    for (const c of t.columns) {
      lines.push([csv(t.name), c.index + 1, csv(c.name), csv(c.type), c.nullable ? 'yes' : 'no'].join(','));
    }
  }
  return lines.join('\n');
}

export function exportDkRowsCsv(table: DkTable): string {
  const header = table.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of table.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveDkSuggestion(state: { hasFiles: boolean; hasError: boolean }): DkSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the analytics sample',
      reason: 'Load a local DuckDB database with orders and products tables.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DuckDB database',
      reason: 'Drop a .duckdb file, SQL dump, or CSV — or load the analytics sample.',
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
