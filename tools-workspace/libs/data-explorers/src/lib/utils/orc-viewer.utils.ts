import { ORC_MAX_FILE_BYTES, ORC_SUPPORTED_EXTENSIONS } from '../constants/orc-viewer.constants';
import type { OrcColumn, OrcDataset, OrcLoadedFile, OrcMetadataRow, OrcStripe, OrcSuggestion } from '../types/orc-viewer.types';
import { buildSampleOrcBytes, parseOrcBytes } from './orc-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatOrcFileSize,
  readFileBytes as readOrcFileBytes
} from './data-file.utils';

export { buildSampleOrcBytes, filterOrcColumns, filterOrcRows, parseOrcBytes, parseOrcText } from './orc-viewer-parse.utils';
export { orcColumnColor, renderOrcPreview, renderOrcSchema, renderOrcStripes } from './orc-viewer-render.utils';

export function isSupportedOrcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (ORC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateOrcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ORC_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(ORC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidOrcFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed ORC files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedOrcFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .orc, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateOrcFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleOrcFile(): File {
  return new File([dataBytesToBlobPart(buildSampleOrcBytes())], 'hive-facts.orc', { type: 'application/octet-stream', lastModified: 0 });
}

export function createOrcFileRecord(file: File, bytes: Uint8Array): OrcLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: OrcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseOrcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse ORC');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportOrc(file: OrcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildOrcMetadataRows(dataset: OrcDataset): OrcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Compression', value: dataset.compression || '—' },
    { key: 'Rows', value: String(dataset.numRows) },
    { key: 'Columns', value: String(dataset.columns.length) },
    { key: 'Stripes', value: String(dataset.stripes.length) }
  ];
}

export function buildOrcColumnMetadata(column: OrcColumn): OrcMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Path', value: column.path }
  ];
}

export function buildOrcStripeMetadata(stripe: OrcStripe): OrcMetadataRow[] {
  return [
    { key: 'Index', value: String(stripe.index) },
    { key: 'Offset', value: String(stripe.offset) },
    { key: 'Rows', value: String(stripe.numRows) },
    { key: 'Data', value: String(stripe.dataLength) },
    { key: 'Footer', value: String(stripe.footerLength) }
  ];
}

export function exportOrcSummaryJson(file: OrcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ORC table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      compression: parsed.compression,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({ name: c.name, type: c.type, path: c.path })),
      stripes: parsed.stripes,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportOrcSchemaCsv(dataset: OrcDataset): string {
  const lines = ['index,name,type,path'];
  for (const c of dataset.columns) {
    lines.push([c.index + 1, csv(c.name), csv(c.type), csv(c.path)].join(','));
  }
  return lines.join('\n');
}

export function exportOrcRowsCsv(dataset: OrcDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveOrcSuggestion(state: { hasFiles: boolean; hasError: boolean }): OrcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the Hive facts sample',
      reason: 'Load a local ORC table with orderId, sku, total, and itemCount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an ORC table',
      reason: 'Drop a .orc file, JSON dump, or CSV — or load the Hive facts sample.',
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
