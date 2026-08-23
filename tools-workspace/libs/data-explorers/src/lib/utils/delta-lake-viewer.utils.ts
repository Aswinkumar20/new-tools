import { DL_MAX_FILE_BYTES, DL_SUPPORTED_EXTENSIONS } from '../constants/delta-lake-viewer.constants';
import type { DlColumn, DlDataset, DlLoadedFile, DlMetadataRow, DlSuggestion, DlVersion } from '../types/delta-lake-viewer.types';
import { buildSampleDeltaBytes, parseDeltaBytes } from './delta-lake-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatDlFileSize,
  readFileBytes as readDlFileBytes
} from './data-file.utils';

export {
  buildSampleDeltaBytes,
  filterDlColumns,
  filterDlRows,
  filterDlVersions,
  parseDeltaBytes,
  parseDeltaText
} from './delta-lake-viewer-parse.utils';
export { dlColumnColor, renderDlPreview, renderDlSchema, renderDlVersions } from './delta-lake-viewer-render.utils';

export function isSupportedDlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateDlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DL_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(DL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Delta files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .delta, .json, .ndjson, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDlFile(): File {
  return new File([dataBytesToBlobPart(buildSampleDeltaBytes())], 'event-log.delta', { type: 'application/octet-stream', lastModified: 0 });
}

export function createDlFileRecord(file: File, bytes: Uint8Array): DlLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDeltaBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Delta');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDl(file: DlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDlMetadataRows(dataset: DlDataset): DlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Protocol', value: dataset.protocol || '—' },
    { key: 'Rows', value: String(dataset.numRows) },
    { key: 'Columns', value: String(dataset.columns.length) },
    { key: 'Versions', value: String(dataset.versions.length) }
  ];
}

export function buildDlColumnMetadata(column: DlColumn): DlMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Nullable', value: column.nullable ? 'yes' : 'no' },
    { key: 'Path', value: column.path }
  ];
}

export function buildDlVersionMetadata(version: DlVersion): DlMetadataRow[] {
  return [
    { key: 'Version', value: String(version.version) },
    { key: 'Timestamp', value: version.timestamp },
    { key: 'Operation', value: version.operation },
    { key: 'Files', value: String(version.numFiles) },
    { key: 'Rows', value: String(version.numRows) }
  ];
}

export function exportDlSummaryJson(file: DlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Delta table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      protocol: parsed.protocol,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, path: c.path })),
      versions: parsed.versions,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportDlSchemaCsv(dataset: DlDataset): string {
  const lines = ['index,name,type,nullable,path'];
  for (const c of dataset.columns) {
    lines.push([c.index + 1, csv(c.name), csv(c.type), c.nullable ? 'yes' : 'no', csv(c.path)].join(','));
  }
  return lines.join('\n');
}

export function exportDlRowsCsv(dataset: DlDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveDlSuggestion(state: { hasFiles: boolean; hasError: boolean }): DlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the event log sample',
      reason: 'Load a local Delta log with versions, schema, and sample events.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Delta table dump',
      reason: 'Drop a .delta / _delta_log JSON dump, or CSV — or load the event log sample.',
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
