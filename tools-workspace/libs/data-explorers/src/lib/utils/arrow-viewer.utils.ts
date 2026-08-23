import { AR_MAX_FILE_BYTES, AR_SUPPORTED_EXTENSIONS } from '../constants/arrow-viewer.constants';
import type { ArBatch, ArColumn, ArDataset, ArLoadedFile, ArMetadataRow, ArSuggestion } from '../types/arrow-viewer.types';
import { buildSampleArrowBytes, parseArrowBytes } from './arrow-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatArFileSize,
  readFileBytes as readArFileBytes
} from './data-file.utils';

export { buildSampleArrowBytes, filterArColumns, filterArRows, parseArrowBytes, parseArrowText } from './arrow-viewer-parse.utils';
export { arColumnColor, renderArBatches, renderArPreview, renderArSchema } from './arrow-viewer-render.utils';

export function isSupportedArFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (AR_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateArFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > AR_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(AR_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidArFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Arrow files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedArFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .arrow, .ipc, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateArFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleArFile(): File {
  return new File([dataBytesToBlobPart(buildSampleArrowBytes())], 'telemetry.arrow', {
    type: 'application/vnd.apache.arrow.file',
    lastModified: 0
  });
}

export function createArFileRecord(file: File, bytes: Uint8Array): ArLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: ArDataset | null = null;
  let softFail = false;
  try {
    parsed = parseArrowBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Arrow');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportAr(file: ArLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildArMetadataRows(dataset: ArDataset): ArMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Rows', value: String(dataset.numRows) },
    { key: 'Columns', value: String(dataset.columns.length) },
    { key: 'Batches', value: String(dataset.batches.length) }
  ];
}

export function buildArColumnMetadata(column: ArColumn): ArMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Path', value: column.path }
  ];
}

export function buildArBatchMetadata(batch: ArBatch): ArMetadataRow[] {
  return [
    { key: 'Index', value: String(batch.index) },
    { key: 'Rows', value: String(batch.numRows) },
    { key: 'Offset', value: String(batch.bodyOffset) },
    { key: 'Bytes', value: String(batch.bodyLength) }
  ];
}

export function exportArSummaryJson(file: ArLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Arrow table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({ name: c.name, type: c.type, path: c.path })),
      batches: parsed.batches,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportArSchemaCsv(dataset: ArDataset): string {
  const lines = ['index,name,type,path'];
  for (const c of dataset.columns) {
    lines.push([c.index + 1, csv(c.name), csv(c.type), csv(c.path)].join(','));
  }
  return lines.join('\n');
}

export function exportArRowsCsv(dataset: ArDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveArSuggestion(state: { hasFiles: boolean; hasError: boolean }): ArSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the telemetry sample',
      reason: 'Load a local Arrow table with orderId, sku, total, and itemCount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an Arrow table',
      reason: 'Drop a .arrow / .ipc file, JSON dump, or CSV — or load the device telemetry sample.',
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
