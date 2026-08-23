import { PQ_MAX_FILE_BYTES, PQ_SUPPORTED_EXTENSIONS } from '../constants/parquet-viewer.constants';
import type { PqColumn, PqDataset, PqLoadedFile, PqMetadataRow, PqSuggestion } from '../types/parquet-viewer.types';
import { buildSampleParquetBytes, parseParquetBytes } from './parquet-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatPqFileSize,
  readFileBytes as readPqFileBytes
} from './data-file.utils';

export { buildSampleParquetBytes, filterPqColumns, filterPqRows, parseParquetBytes, parseParquetText } from './parquet-viewer-parse.utils';
export { pqColumnColor, renderPqProfiling, renderPqRows, renderPqSchema } from './parquet-viewer-render.utils';

export function isSupportedPqFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PQ_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validatePqFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PQ_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(PQ_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPqFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Parquet files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPqFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .parquet, .parq, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validatePqFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePqFile(): File {
  return new File([dataBytesToBlobPart(buildSampleParquetBytes())], 'nyc-taxi.parquet', {
    type: 'application/vnd.apache.parquet',
    lastModified: 0
  });
}

export function createPqFileRecord(file: File, bytes: Uint8Array): PqLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PqDataset | null = null;
  let softFail = false;
  try {
    parsed = parseParquetBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Parquet');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPq(file: PqLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPqMetadataRows(dataset: PqDataset): PqMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Created by', value: dataset.createdBy || '—' },
    { key: 'Version', value: String(dataset.version) },
    { key: 'Rows', value: String(dataset.numRows) },
    { key: 'Columns', value: String(dataset.columns.length) },
    { key: 'Row groups', value: String(dataset.rowGroups.length) }
  ];
}

export function buildPqColumnMetadata(column: PqColumn): PqMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Logical', value: column.convertedType || '—' },
    { key: 'Repetition', value: column.repetition },
    { key: 'Path', value: column.path }
  ];
}

export function exportPqSummaryJson(file: PqLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Parquet table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      createdBy: parsed.createdBy,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({
        name: c.name,
        type: c.type,
        convertedType: c.convertedType,
        repetition: c.repetition
      })),
      rowGroups: parsed.rowGroups,
      rows: parsed.rows,
      profiles: parsed.profiles
    },
    null,
    2
  );
}

export function exportPqSchemaCsv(dataset: PqDataset): string {
  const lines = ['index,name,type,logical,repetition'];
  for (const c of dataset.columns) {
    lines.push([c.index + 1, csv(c.name), csv(c.type), csv(c.convertedType), csv(c.repetition)].join(','));
  }
  return lines.join('\n');
}

export function exportPqRowsCsv(dataset: PqDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolvePqSuggestion(state: { hasFiles: boolean; hasError: boolean }): PqSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the NYC taxi sample',
      reason: 'Load a local Parquet table with orderId, sku, total, and itemCount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Parquet table',
      reason: 'Drop a .parquet file, JSON dump, or CSV — or load the NYC taxi sample.',
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
