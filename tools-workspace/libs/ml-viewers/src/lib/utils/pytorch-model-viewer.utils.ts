import { PT_MAX_FILE_BYTES, PT_SUPPORTED_EXTENSIONS } from '../constants/pytorch-model-viewer.constants';
import type { PtDataset, PtLayer, PtLoadedFile, PtMetadataRow, PtParam, PtSuggestion } from '../types/pytorch-model-viewer.types';
import { buildSamplePtBytes, parsePtBytes } from './pytorch-model-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatPtFileSize,
  readFileBytes as readPtFileBytes
} from './ml-file.utils';

export {
  buildSamplePtBytes,
  buildSamplePtJson,
  filterPtLayers,
  filterPtParams,
  filterPtRows,
  parsePtBytes,
  parsePtText
} from './pytorch-model-viewer-parse.utils';
export { ptTypeColor, renderPtLayers, renderPtParams, renderPtPreview } from './pytorch-model-viewer-render.utils';

export function isSupportedPtFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validatePtFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PT_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(PT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPtFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed PyTorch files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPtFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pt, .pth, .bin, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validatePtFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePtFile(): File {
  return new File([buildSamplePtBytes() as BlobPart], 'sample-shop-ranker.pt', { type: 'application/octet-stream', lastModified: 0 });
}

export function createPtFileRecord(file: File, bytes: Uint8Array): PtLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PtDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePtBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.params.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PyTorch model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPt(file: PtLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPtMetadataRows(dataset: PtDataset): PtMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Format', value: dataset.format },
    { key: 'Torch', value: dataset.torchVersion },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Params', value: String(dataset.paramCount) }
  ];
}

export function buildPtLayerMetadata(layer: PtLayer): PtMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Type', value: layer.type },
    { key: 'In', value: layer.inFeatures || '—' },
    { key: 'Out', value: layer.outFeatures || '—' },
    { key: 'Params', value: String(layer.paramCount) }
  ];
}

export function buildPtParamMetadata(param: PtParam): PtMetadataRow[] {
  return [
    { key: 'Name', value: param.name },
    { key: 'Layer', value: param.layer || '—' },
    { key: 'Kind', value: param.kind },
    { key: 'DType', value: param.dtype },
    { key: 'Shape', value: param.shapeLabel },
    { key: 'Numel', value: String(param.numel) }
  ];
}

export function exportPtSummaryJson(file: PtLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PyTorch model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      torchVersion: parsed.torchVersion,
      format: parsed.format,
      layers: parsed.layers.map((l) => ({
        name: l.name,
        type: l.type,
        inFeatures: l.inFeatures,
        outFeatures: l.outFeatures,
        paramCount: l.paramCount
      })),
      params: parsed.params.map((p) => ({
        name: p.name,
        layer: p.layer,
        kind: p.kind,
        dtype: p.dtype,
        shape: p.shape,
        numel: p.numel
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPtSchemaCsv(dataset: PtDataset): string {
  const lines = ['kind,name,type,shape,numel,layer'];
  for (const l of dataset.layers) {
    lines.push(['layer', csv(l.name), csv(l.type), '', String(l.paramCount), ''].join(','));
  }
  for (const p of dataset.params) {
    lines.push(['param', csv(p.name), csv(p.dtype), csv(p.shapeLabel), String(p.numel), csv(p.layer)].join(','));
  }
  return lines.join('\n');
}

export function exportPtRowsCsv(dataset: PtDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolvePtSuggestion(state: { hasFiles: boolean; hasError: boolean }): PtSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker PyTorch sample',
      reason: 'Load a tiny Linear → ReLU → Linear → Softmax ranker with weight and bias params.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PyTorch model',
      reason: 'Drop a .pt / .pth checkpoint, JSON dump, or CSV layer list — or load the sample ranker.',
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
