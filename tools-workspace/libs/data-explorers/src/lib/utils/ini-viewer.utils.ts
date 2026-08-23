import { IN_MAX_FILE_BYTES, IN_SUPPORTED_EXTENSIONS } from '../constants/ini-viewer.constants';
import type { InDataset, InKey, InLoadedFile, InMetadataRow, InSection, InSuggestion } from '../types/ini-viewer.types';
import { buildSampleIniBytes, parseIniBytes } from './ini-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatInFileSize,
  readFileBytes as readInFileBytes
} from './data-file.utils';

export {
  buildSampleIniBytes,
  filterInKeys,
  filterInRows,
  filterInSections,
  parseIniBytes,
  parseIniText
} from './ini-viewer-parse.utils';
export { inTypeColor, renderInKeys, renderInPreview, renderInSections } from './ini-viewer-render.utils';

export function isSupportedInFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (IN_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateInFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > IN_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(IN_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidInFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed INI files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedInFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .ini, .cfg, .conf, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateInFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleInFile(): File {
  return new File([dataBytesToBlobPart(buildSampleIniBytes())], 'app-config.ini', { type: 'text/plain', lastModified: 0 });
}

export function createInFileRecord(file: File, bytes: Uint8Array): InLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: InDataset | null = null;
  let softFail = false;
  try {
    parsed = parseIniBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.sections.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse INI');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportIn(file: InLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildInMetadataRows(dataset: InDataset): InMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Sections', value: String(dataset.sectionCount) },
    { key: 'Keys', value: String(dataset.keyCount) },
    { key: 'Rows', value: String(dataset.rows.length) }
  ];
}

export function buildInSectionMetadata(section: InSection): InMetadataRow[] {
  return [
    { key: 'Name', value: section.name },
    { key: 'Kind', value: section.kind },
    { key: 'Path', value: section.path || '(root)' },
    { key: 'Keys', value: String(section.keyCount) },
    { key: 'Rows', value: String(section.numRows) }
  ];
}

export function buildInKeyMetadata(key: InKey): InMetadataRow[] {
  return [
    { key: 'Name', value: key.name },
    { key: 'Path', value: key.path },
    { key: 'Type', value: key.type },
    { key: 'Value', value: key.value || '—' },
    { key: 'Section', value: key.section || '(root)' }
  ];
}

export function exportInSummaryJson(file: InLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed INI document');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sectionCount: parsed.sectionCount,
      keyCount: parsed.keyCount,
      sections: parsed.sections.map((s) => ({
        name: s.name,
        kind: s.kind,
        keyCount: s.keyCount,
        numRows: s.numRows,
        keys: s.keys.map((k) => ({ name: k.name, type: k.type, value: k.value })),
        rows: s.rows
      })),
      columns: parsed.columns,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportInSchemaCsv(dataset: InDataset): string {
  const lines = ['section,path,name,type,value'];
  for (const k of dataset.keys) {
    lines.push([csv(k.section), csv(k.path), csv(k.name), csv(k.type), csv(k.value)].join(','));
  }
  return lines.join('\n');
}

export function exportInRowsCsv(section: InSection): string {
  const header = section.keys.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of section.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveInSuggestion(state: { hasFiles: boolean; hasError: boolean }): InSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the app config sample',
      reason: 'Load a local INI document with [shop], [meta], and [orders.*] sections.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an INI document',
      reason: 'Drop a .ini / .cfg file, JSON dump, or CSV — or load the app config sample.',
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
