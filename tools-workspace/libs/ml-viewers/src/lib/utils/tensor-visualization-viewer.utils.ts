import { TV_MAX_FILE_BYTES, TV_SUPPORTED_EXTENSIONS } from '../constants/tensor-visualization-viewer.constants';
import type { TvDataset, TvLoadedFile, TvMetadataRow, TvSuggestion, TvTensor } from '../types/tensor-visualization-viewer.types';
import { buildSampleTvBytes, parseTvBytes } from './tensor-visualization-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatTvFileSize,
  readFileBytes as readTvFileBytes
} from './ml-file.utils';

export {
  buildSampleNpyBytes,
  buildSampleTvBytes,
  buildSampleTvJson,
  filterTvRows,
  filterTvShapes,
  filterTvStats,
  parseTvBytes,
  parseTvText
} from './tensor-visualization-viewer-parse.utils';
export { renderTvPreview, renderTvShapes, renderTvStats, tvTypeColor } from './tensor-visualization-viewer-render.utils';

export function isSupportedTvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateTvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TV_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(TV_MAX_FILE_BYTES)})`;
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
      rejected.push({ name: file.name, reason: 'Compressed tensor dumps are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTvFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .tensor, .npy, .npz, .json, .csv, .md, or .txt)' });
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
  return new File([buildSampleTvBytes() as BlobPart], 'sample-shop-ranker.tensor', { type: 'application/octet-stream', lastModified: 0 });
}

export function createTvFileRecord(file: File, bytes: Uint8Array): TvLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTvBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tensors.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse tensor dump');
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
    { key: 'Framework', value: dataset.framework },
    { key: 'Tensors', value: String(dataset.tensorCount) },
    { key: 'Numel', value: String(dataset.totalNumel) }
  ];
}

export function buildTvTensorMetadata(tensor: TvTensor): TvMetadataRow[] {
  return [
    { key: 'Name', value: tensor.name },
    { key: 'Kind', value: tensor.kind },
    { key: 'DType', value: tensor.dtype },
    { key: 'Shape', value: tensor.shapeLabel },
    { key: 'Numel', value: String(tensor.numel) },
    { key: 'Min', value: tensor.min || '—' },
    { key: 'Max', value: tensor.max || '—' },
    { key: 'Mean', value: tensor.mean || '—' },
    { key: 'Std', value: tensor.std || '—' },
    { key: 'NNZ', value: tensor.nnz || '—' }
  ];
}

export function exportTvSummaryJson(file: TvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed tensor dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      framework: parsed.framework,
      tensors: parsed.tensors.map((t) => ({
        name: t.name,
        kind: t.kind,
        dtype: t.dtype,
        shape: t.shape,
        numel: t.numel,
        min: t.min,
        max: t.max,
        mean: t.mean,
        std: t.std,
        nnz: t.nnz
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportTvSchemaCsv(dataset: TvDataset): string {
  const lines = ['kind,name,dtype,shape,numel,stat'];
  for (const t of dataset.tensors) {
    const stat = [t.min, t.max].filter(Boolean).join('..');
    lines.push([csv(t.kind), csv(t.name), csv(t.dtype), csv(t.shapeLabel), String(t.numel), csv(stat)].join(','));
  }
  return lines.join('\n');
}

export function exportTvRowsCsv(dataset: TvDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveTvSuggestion(state: { hasFiles: boolean; hasError: boolean }): TvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker tensor sample',
      reason: 'Load a tiny ranker dump with input, weight, bias, and output tensors plus stats.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a tensor dump',
      reason: 'Drop a .tensor / .npy dump, JSON, or CSV — or load the sample ranker tensors.',
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
