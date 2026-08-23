import { KS_MAX_FILE_BYTES, KS_SUPPORTED_EXTENSIONS } from '../constants/keras-model-viewer.constants';
import type { KsDataset, KsLayer, KsLoadedFile, KsMetadataRow, KsShape, KsSuggestion } from '../types/keras-model-viewer.types';
import { buildSampleKsBytes, parseKsBytes } from './keras-model-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatKsFileSize,
  readFileBytes as readKsFileBytes
} from './ml-file.utils';

export {
  buildSampleKsBytes,
  buildSampleKsJson,
  filterKsLayers,
  filterKsRows,
  filterKsShapes,
  parseKsBytes,
  parseKsText
} from './keras-model-viewer-parse.utils';
export { ksTypeColor, renderKsLayers, renderKsPreview, renderKsShapes } from './keras-model-viewer-render.utils';

export function isSupportedKsFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (KS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateKsFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > KS_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(KS_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidKsFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Keras files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedKsFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .keras, .h5, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateKsFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleKsFile(): File {
  return new File([buildSampleKsBytes() as BlobPart], 'sample-shop-ranker.keras', { type: 'application/octet-stream', lastModified: 0 });
}

export function createKsFileRecord(file: File, bytes: Uint8Array): KsLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: KsDataset | null = null;
  let softFail = false;
  try {
    parsed = parseKsBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.shapes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Keras model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportKs(file: KsLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildKsMetadataRows(dataset: KsDataset): KsMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Class', value: dataset.className },
    { key: 'Keras', value: dataset.kerasVersion },
    { key: 'Backend', value: dataset.backend },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Shapes', value: String(dataset.shapeCount) }
  ];
}

export function buildKsLayerMetadata(layer: KsLayer): KsMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Type', value: layer.type },
    { key: 'Activation', value: layer.activation || '—' },
    { key: 'Units', value: layer.units || '—' },
    { key: 'In', value: layer.inputShape || '—' },
    { key: 'Out', value: layer.outputShape || '—' },
    { key: 'Trainable', value: layer.trainable ? 'yes' : 'no' }
  ];
}

export function buildKsShapeMetadata(shape: KsShape): KsMetadataRow[] {
  return [
    { key: 'Name', value: shape.name },
    { key: 'Kind', value: shape.kind },
    { key: 'DType', value: shape.dtype },
    { key: 'Shape', value: shape.shapeLabel },
    { key: 'Layer', value: shape.layer || '—' }
  ];
}

export function exportKsSummaryJson(file: KsLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Keras model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      className: parsed.className,
      kerasVersion: parsed.kerasVersion,
      backend: parsed.backend,
      layers: parsed.layers.map((l) => ({
        name: l.name,
        type: l.type,
        activation: l.activation,
        units: l.units,
        inputShape: l.inputShape,
        outputShape: l.outputShape
      })),
      shapes: parsed.shapes.map((s) => ({ name: s.name, kind: s.kind, dtype: s.dtype, shape: s.shape, layer: s.layer })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportKsSchemaCsv(dataset: KsDataset): string {
  const lines = ['kind,name,type,activation,units,shape'];
  for (const l of dataset.layers) {
    lines.push(['layer', csv(l.name), csv(l.type), csv(l.activation), csv(l.units), csv(l.outputShape || l.inputShape)].join(','));
  }
  for (const s of dataset.shapes) {
    lines.push(['shape', csv(s.name), csv(s.kind), '', '', csv(s.shapeLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportKsRowsCsv(dataset: KsDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveKsSuggestion(state: { hasFiles: boolean; hasError: boolean }): KsSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker Keras sample',
      reason: 'Load a tiny Input → Dense → ReLU → Dense → Softmax ranker with layer shapes.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Keras model',
      reason: 'Drop a .keras / .h5 file, JSON dump, or CSV layer list — or load the sample ranker.',
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
