import { TV_MAX_FILE_BYTES, TV_SUPPORTED_EXTENSIONS } from '../constants/tsv-viewer.constants';
import type { TvColumn, TvDataset, TvLoadedFile, TvMetadataRow, TvSuggestion } from '../types/tsv-viewer.types';
import { buildSampleTsvBytes, parseTsvBytes } from './tsv-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatTvFileSize,
  readFileBytes as readTvFileBytes
} from './data-file.utils';

export { buildSampleTsvBytes, filterTvColumns, filterTvRows, parseTsvBytes, parseTsvText } from './tsv-viewer-parse.utils';
export { renderTvColumns, renderTvPreview, renderTvSchema, tvColumnColor } from './tsv-viewer-render.utils';

function delimiterLabel(delimiter: string): string {
  if (delimiter === ',') return ', (comma)';
  if (delimiter === ';') return '; (semicolon)';
  if (delimiter === '|') return '| (pipe)';
  return 'tab';
}

export function isSupportedTvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateTvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TV_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(TV_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTvFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed TSV files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTvFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .tsv, .tab, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateTvFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTvFile(): File {
  return new File([dataBytesToBlobPart(buildSampleTsvBytes())], 'blast-hits.tsv', { type: 'text/tab-separated-values', lastModified: 0 });
}

export function createTvFileRecord(file: File, bytes: Uint8Array): TvLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTsvBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.columns.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse TSV');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTv(file: TvLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTvMetadataRows(dataset: TvDataset): TvMetadataRow[] {
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

export function buildTvColumnMetadata(column: TvColumn): TvMetadataRow[] {
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

export function exportTvSummaryJson(file: TvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed TSV table');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      delimiter: parsed.delimiter === '\t' ? '\\t' : parsed.delimiter,
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

export function exportTvSchemaCsv(dataset: TvDataset): string {
  const lines = ['index,name,type,nullable,nulls,distinct,min,max'];
  for (const c of dataset.columns) {
    lines.push(
      [c.index + 1, csv(c.name), csv(c.type), c.nullable ? 'yes' : 'no', c.nullCount, c.uniqueCount, csv(c.min), csv(c.max)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportTvRowsTsv(dataset: TvDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(tsv).join('\t')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => tsv(row[h] || '')).join('\t'));
  }
  return lines.join('\n');
}

export function resolveTvSuggestion(state: { hasFiles: boolean; hasError: boolean }): TvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the BLAST hits sample',
      reason: 'Load a local TSV table with orders, quoted notes, and an empty field.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a TSV table',
      reason: 'Drop a .tsv / .tab file, JSON dump, or Markdown — or load the BLAST hits sample.',
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

function tsv(value: string): string {
  if (/["\t\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
