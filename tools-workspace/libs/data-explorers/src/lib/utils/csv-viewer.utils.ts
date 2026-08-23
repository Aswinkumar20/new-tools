import { CV_MAX_FILE_BYTES, CV_SUPPORTED_EXTENSIONS } from '../constants/csv-viewer.constants';
import type { CvColumn, CvDataset, CvLoadedFile, CvMetadataRow, CvSuggestion } from '../types/csv-viewer.types';
import { buildSampleCsvBytes, parseCsvBytes } from './csv-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatCvFileSize,
  readFileBytes as readCvFileBytes
} from './data-file.utils';

export { buildSampleCsvBytes, filterCvColumns, filterCvRows, parseCsvBytes, parseCsvText } from './csv-viewer-parse.utils';
export { cvColumnColor, renderCvColumns, renderCvPreview, renderCvSchema } from './csv-viewer-render.utils';

function delimiterLabel(delimiter: string): string {
  if (delimiter === '\t') return 'tab';
  if (delimiter === ';') return '; (semicolon)';
  if (delimiter === '|') return '| (pipe)';
  return ', (comma)';
}

export function isSupportedCvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (CV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateCvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > CV_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(CV_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidCvFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed CSV files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedCvFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .csv, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateCvFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleCvFile(): File {
  return new File([dataBytesToBlobPart(buildSampleCsvBytes())], 'bakery-invoices.csv', { type: 'text/csv', lastModified: 0 });
}

export function createCvFileRecord(file: File, bytes: Uint8Array): CvLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: CvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseCsvBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse CSV');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportCv(file: CvLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildCvMetadataRows(dataset: CvDataset): CvMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Delimiter', value: delimiterLabel(dataset.delimiter) },
    { key: 'Header', value: dataset.hasHeader ? 'yes' : 'no' },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Line ending', value: dataset.lineEnding || '—' },
    { key: 'Columns', value: String(dataset.columns.length) },
    { key: 'Rows', value: String(dataset.numRows) }
  ];
}

export function buildCvColumnMetadata(column: CvColumn): CvMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type },
    { key: 'Nullable', value: column.nullable ? 'yes' : 'no' },
    { key: 'Nulls', value: String(column.nullCount) },
    { key: 'Distinct', value: String(column.uniqueCount) },
    { key: 'Min', value: column.min || '—' },
    { key: 'Max', value: column.max || '—' },
    { key: 'Sample', value: column.sample || '—' }
  ];
}

export function exportCvSummaryJson(file: CvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed CSV table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      delimiter: parsed.delimiter,
      hasHeader: parsed.hasHeader,
      encoding: parsed.encoding,
      lineEnding: parsed.lineEnding,
      numRows: parsed.numRows,
      columns: parsed.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        nullCount: c.nullCount,
        uniqueCount: c.uniqueCount,
        min: c.min,
        max: c.max
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportCvSchemaCsv(dataset: CvDataset): string {
  const lines = ['index,name,type,nullable,nulls,distinct,min,max'];
  for (const c of dataset.columns) {
    lines.push(
      [c.index + 1, csv(c.name), csv(c.type), c.nullable ? 'yes' : 'no', c.nullCount, c.uniqueCount, csv(c.min), csv(c.max)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportCvRowsCsv(dataset: CvDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveCvSuggestion(state: { hasFiles: boolean; hasError: boolean }): CvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the bakery invoices sample',
      reason: 'Load a local CSV table with orders, quoted notes, and an empty field.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a CSV table',
      reason: 'Drop a .csv file, JSON dump, or Markdown — or load the bakery invoices sample.',
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
