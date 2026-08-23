import { TM_MAX_FILE_BYTES, TM_SUPPORTED_EXTENSIONS } from '../constants/toml-viewer.constants';
import type { TmDataset, TmKey, TmLoadedFile, TmMetadataRow, TmSuggestion, TmTable } from '../types/toml-viewer.types';
import { buildSampleTomlBytes, parseTomlBytes } from './toml-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatTmFileSize,
  readFileBytes as readTmFileBytes
} from './data-file.utils';

export {
  buildSampleTomlBytes,
  filterTmKeys,
  filterTmRows,
  filterTmTables,
  parseTomlBytes,
  parseTomlText
} from './toml-viewer-parse.utils';
export { renderTmKeys, renderTmPreview, renderTmTables, tmTypeColor } from './toml-viewer-render.utils';

export function isSupportedTmFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateTmFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TM_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(TM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTmFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed TOML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTmFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .toml, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateTmFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTmFile(): File {
  return new File([dataBytesToBlobPart(buildSampleTomlBytes())], 'cargo-config.toml', { type: 'application/toml', lastModified: 0 });
}

export function createTmFileRecord(file: File, bytes: Uint8Array): TmLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TmDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTomlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse TOML');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTm(file: TmLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTmMetadataRows(dataset: TmDataset): TmMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Tables', value: String(dataset.tableCount) },
    { key: 'Keys', value: String(dataset.keyCount) },
    { key: 'Rows', value: String(dataset.rows.length) }
  ];
}

export function buildTmTableMetadata(table: TmTable): TmMetadataRow[] {
  return [
    { key: 'Name', value: table.name },
    { key: 'Kind', value: table.kind },
    { key: 'Path', value: table.path || '(root)' },
    { key: 'Keys', value: String(table.keyCount) },
    { key: 'Rows', value: String(table.numRows) }
  ];
}

export function buildTmKeyMetadata(key: TmKey): TmMetadataRow[] {
  return [
    { key: 'Name', value: key.name },
    { key: 'Path', value: key.path },
    { key: 'Type', value: key.type },
    { key: 'Value', value: key.value || '—' },
    { key: 'Table', value: key.table }
  ];
}

export function exportTmSummaryJson(file: TmLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed TOML document');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      tableCount: parsed.tableCount,
      keyCount: parsed.keyCount,
      tables: parsed.tables.map((t) => ({
        name: t.name,
        kind: t.kind,
        keyCount: t.keyCount,
        numRows: t.numRows,
        keys: t.keys.map((k) => ({ name: k.name, type: k.type, value: k.value })),
        rows: t.rows
      })),
      columns: parsed.columns,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportTmSchemaCsv(dataset: TmDataset): string {
  const lines = ['table,path,name,type,value'];
  for (const k of dataset.keys) {
    lines.push([csv(k.table), csv(k.path), csv(k.name), csv(k.type), csv(k.value)].join(','));
  }
  return lines.join('\n');
}

export function exportTmRowsCsv(table: TmTable): string {
  const header = table.keys.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of table.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveTmSuggestion(state: { hasFiles: boolean; hasError: boolean }): TmSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the Cargo config sample',
      reason: 'Load a local TOML document with root keys, a [meta] table, and [[orders]].',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a TOML document',
      reason: 'Drop a .toml file, JSON dump, or CSV — or load the Cargo config sample.',
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
