import { FT_MAX_FILE_BYTES, FT_SUPPORTED_EXTENSIONS } from '../constants/feather-viewer.constants';
import type { FtColumn, FtDataset, FtLoadedFile, FtMetadataRow, FtSuggestion } from '../types/feather-viewer.types';
import { buildSampleFeatherBytes, parseFeatherBytes } from './feather-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatFtFileSize,
  readFileBytes as readFtFileBytes
} from './data-file.utils';

export { buildSampleFeatherBytes, filterFtColumns, filterFtRows, parseFeatherBytes, parseFeatherText } from './feather-viewer-parse.utils';
export { ftColumnColor, renderFtDiagram, renderFtPreview, renderFtSchema } from './feather-viewer-render.utils';

export function isSupportedFtFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateFtFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FT_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(FT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFtFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Feather files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedFtFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .feather, .arrow, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateFtFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFtFile(): File {
  return new File([dataBytesToBlobPart(buildSampleFeatherBytes())], 'pandas-metrics.feather', {
    type: 'application/vnd.apache.arrow.file',
    lastModified: 0
  });
}

export function createFtFileRecord(file: File, bytes: Uint8Array): FtLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FtDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFeatherBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Feather');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFt(file: FtLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFtMetadataRows(dataset: FtDataset): FtMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Rows', value: String(dataset.numRows) },
    { key: 'Columns', value: String(dataset.columns.length) }
  ];
}

export function buildFtColumnMetadata(column: FtColumn): FtMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Offset', value: String(column.offset) },
    { key: 'Bytes', value: String(column.byteLength) }
  ];
}

export function exportFtSummaryJson(file: FtLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Feather table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({
        name: c.name,
        type: c.type,
        offset: c.offset,
        byteLength: c.byteLength
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportFtSchemaCsv(dataset: FtDataset): string {
  const lines = ['index,name,type,offset,bytes'];
  for (const c of dataset.columns) {
    lines.push([c.index + 1, csv(c.name), csv(c.type), String(c.offset), String(c.byteLength)].join(','));
  }
  return lines.join('\n');
}

export function exportFtRowsCsv(dataset: FtDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveFtSuggestion(state: { hasFiles: boolean; hasError: boolean }): FtSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the pandas metrics sample',
      reason: 'Load a local Feather table with orderId, sku, total, and itemCount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Feather table',
      reason: 'Drop a .feather / .arrow file, JSON dump, or CSV — or load the pandas metrics sample.',
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
