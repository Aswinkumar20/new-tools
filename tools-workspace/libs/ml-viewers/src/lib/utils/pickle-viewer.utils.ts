import { PK_MAX_FILE_BYTES, PK_SUPPORTED_EXTENSIONS } from '../constants/pickle-viewer.constants';
import type { PkDataset, PkLoadedFile, PkMetadataRow, PkSuggestion, PkTypeHint, PkWarning } from '../types/pickle-viewer.types';
import { buildSamplePkBytes, parsePkBytes } from './pickle-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatPkFileSize,
  readFileBytes as readPkFileBytes
} from './ml-file.utils';

export {
  buildDangerousPickleProto,
  buildSamplePickleProto,
  buildSamplePkBytes,
  buildSamplePkJson,
  filterPkRows,
  filterPkTypes,
  filterPkWarnings,
  parsePkBytes,
  parsePkText
} from './pickle-viewer-parse.utils';
export { pkTypeColor, renderPkPreview, renderPkTypes, renderPkWarnings } from './pickle-viewer-render.utils';

export function isSupportedPkFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PK_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validatePkFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PK_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(PK_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPkFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed pickle files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPkFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pkl, .pickle, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validatePkFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePkFile(): File {
  return new File([buildSamplePkBytes() as BlobPart], 'sample-shop-ranker.pkl', { type: 'application/octet-stream', lastModified: 0 });
}

export function createPkFileRecord(file: File, bytes: Uint8Array): PkLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PkDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePkBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.types.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse pickle dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPk(file: PkLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPkMetadataRows(dataset: PkDataset): PkMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Protocol', value: dataset.protocol },
    { key: 'Python', value: dataset.python },
    { key: 'Types', value: String(dataset.typeCount) },
    { key: 'Warnings', value: String(dataset.warningCount) }
  ];
}

export function buildPkTypeMetadata(hint: PkTypeHint): PkMetadataRow[] {
  return [
    { key: 'Name', value: hint.name },
    { key: 'Module', value: hint.module || '—' },
    { key: 'Kind', value: hint.kind },
    { key: 'Qualified', value: hint.qualified }
  ];
}

export function buildPkWarningMetadata(item: PkWarning): PkMetadataRow[] {
  return [
    { key: 'Level', value: item.level },
    { key: 'Message', value: item.message }
  ];
}

export function exportPkSummaryJson(file: PkLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed pickle dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      protocol: parsed.protocol,
      python: parsed.python,
      types: parsed.types.map((t) => ({ name: t.name, module: t.module, kind: t.kind, qualified: t.qualified })),
      warnings: parsed.warningItems.map((w) => ({ level: w.level, message: w.message })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPkSchemaCsv(dataset: PkDataset): string {
  const lines = ['kind,name,module,type,warning'];
  for (const t of dataset.types) {
    lines.push(['type', csv(t.name), csv(t.module), csv(t.kind), ''].join(','));
  }
  for (const w of dataset.warningItems) {
    lines.push(['warning', csv(w.level), '', '', csv(w.message)].join(','));
  }
  return lines.join('\n');
}

export function exportPkRowsCsv(dataset: PkDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolvePkSuggestion(state: { hasFiles: boolean; hasError: boolean }): PkSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker pickle sample',
      reason: 'Load a tiny ranker dump with class, ndarray, and Linear type hints — no execution.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a pickle dump',
      reason: 'Drop a .pkl / JSON type list, or load the sample ranker metadata. Never unpickle untrusted files.',
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
