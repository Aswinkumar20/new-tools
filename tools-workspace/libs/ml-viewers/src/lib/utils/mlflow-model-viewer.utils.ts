import { MF_MAX_FILE_BYTES, MF_SUPPORTED_EXTENSIONS } from '../constants/mlflow-model-viewer.constants';
import type { MfArtifact, MfDataset, MfLoadedFile, MfMetadataRow, MfSignature, MfSuggestion } from '../types/mlflow-model-viewer.types';
import { buildSampleMfBytes, parseMfBytes } from './mlflow-model-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatMfFileSize,
  readFileBytes as readMfFileBytes
} from './ml-file.utils';

export {
  buildSampleMfBytes,
  buildSampleMfJson,
  filterMfFiles,
  filterMfRows,
  filterMfSignatures,
  parseMfBytes,
  parseMfText
} from './mlflow-model-viewer-parse.utils';
export { mfTypeColor, renderMfFiles, renderMfPreview, renderMfSignature } from './mlflow-model-viewer-render.utils';

export function isSupportedMfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (MF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateMfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MF_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(MF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed MLflow files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedMfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mlmodel, .yaml, .zip, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateMfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMfFile(): File {
  return new File([buildSampleMfBytes() as BlobPart], 'sample-shop-ranker.zip', { type: 'application/zip', lastModified: 0 });
}

export function createMfFileRecord(file: File, bytes: Uint8Array): MfLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMfBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.signatures.length && !parsed.files.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse MLflow model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMf(file: MfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMfMetadataRows(dataset: MfDataset): MfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Flavor', value: dataset.flavor },
    { key: 'MLflow', value: dataset.mlflowVersion },
    { key: 'Created', value: dataset.utcCreated },
    { key: 'Path', value: dataset.artifactPath },
    { key: 'Signature', value: String(dataset.signatureCount) },
    { key: 'Files', value: String(dataset.fileCount) }
  ];
}

export function buildMfSignatureMetadata(sig: MfSignature): MfMetadataRow[] {
  return [
    { key: 'Name', value: sig.name },
    { key: 'Kind', value: sig.kind },
    { key: 'Type', value: sig.type },
    { key: 'DType', value: sig.dtype },
    { key: 'Shape', value: sig.shapeLabel }
  ];
}

export function buildMfFileMetadata(file: MfArtifact): MfMetadataRow[] {
  return [
    { key: 'Name', value: file.name },
    { key: 'Path', value: file.path },
    { key: 'Role', value: file.role },
    { key: 'Flavor', value: file.flavor || '—' },
    { key: 'Size', value: file.sizeLabel || '—' }
  ];
}

export function exportMfSummaryJson(file: MfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed MLflow model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      mlflowVersion: parsed.mlflowVersion,
      flavor: parsed.flavor,
      artifactPath: parsed.artifactPath,
      signatures: parsed.signatures.map((s) => ({
        name: s.name,
        kind: s.kind,
        type: s.type,
        dtype: s.dtype,
        shape: s.shape
      })),
      files: parsed.files.map((f) => ({ name: f.name, path: f.path, role: f.role, flavor: f.flavor })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportMfSchemaCsv(dataset: MfDataset): string {
  const lines = ['kind,name,type,dtype,shape,flavor'];
  for (const s of dataset.signatures) {
    lines.push(['signature', csv(s.name), csv(s.kind), csv(s.dtype), csv(s.shapeLabel), ''].join(','));
  }
  for (const f of dataset.files) {
    lines.push(['file', csv(f.name), csv(f.role), '', '', csv(f.flavor)].join(','));
  }
  return lines.join('\n');
}

export function exportMfRowsCsv(dataset: MfDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveMfSuggestion(state: { hasFiles: boolean; hasError: boolean }): MfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker MLflow sample',
      reason: 'Load a tiny keras flavor artifact with features → scores signature and MLmodel files.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an MLflow model',
      reason: 'Drop an MLmodel YAML, artifact ZIP, or JSON dump — or load the sample ranker.',
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
