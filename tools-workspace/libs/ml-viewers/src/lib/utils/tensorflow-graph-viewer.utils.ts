import { TF_MAX_FILE_BYTES, TF_SUPPORTED_EXTENSIONS } from '../constants/tensorflow-graph-viewer.constants';
import type { TfDataset, TfLoadedFile, TfMetadataRow, TfNode, TfSuggestion, TfTensor } from '../types/tensorflow-graph-viewer.types';
import { buildSampleTfGraphBytes, parseTfGraphBytes } from './tensorflow-graph-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatTfFileSize,
  readFileBytes as readTfFileBytes
} from './ml-file.utils';

export {
  buildSampleTfGraphBytes,
  buildSampleTfPbtxt,
  filterTfNodes,
  filterTfRows,
  filterTfTensors,
  parseTfGraphBytes,
  parseTfGraphText
} from './tensorflow-graph-viewer-parse.utils';
export { renderTfGraph, renderTfPreview, renderTfTensors, tfTypeColor } from './tensorflow-graph-viewer-render.utils';

export function isSupportedTfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateTfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TF_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(TF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed TensorFlow graphs are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .pb, .pbtxt, .graphdef, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateTfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTfFile(): File {
  return new File([buildSampleTfGraphBytes() as BlobPart], 'sample-shop-ranker.pb', { type: 'application/octet-stream', lastModified: 0 });
}

export function createTfFileRecord(file: File, bytes: Uint8Array): TfLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTfGraphBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length && !parsed.tensors.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse TensorFlow graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTf(file: TfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTfMetadataRows(dataset: TfDataset): TfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Producer', value: dataset.producer },
    { key: 'TF', value: dataset.tfVersion },
    { key: 'Nodes', value: String(dataset.nodeCount) },
    { key: 'Tensors', value: String(dataset.tensorCount) }
  ];
}

export function buildTfNodeMetadata(node: TfNode): TfMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Op', value: node.op },
    { key: 'Device', value: node.device || '—' },
    { key: 'Inputs', value: node.inputs.join(', ') || '—' }
  ];
}

export function buildTfTensorMetadata(tensor: TfTensor): TfMetadataRow[] {
  return [
    { key: 'Name', value: tensor.name },
    { key: 'Kind', value: tensor.kind },
    { key: 'DType', value: tensor.dtype },
    { key: 'Shape', value: tensor.shapeLabel },
    { key: 'Size', value: String(tensor.size) },
    { key: 'Preview', value: tensor.preview || '—' }
  ];
}

export function exportTfSummaryJson(file: TfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed TensorFlow graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      producer: parsed.producer,
      tfVersion: parsed.tfVersion,
      nodes: parsed.nodes.map((n) => ({ name: n.name, op: n.op, inputs: n.inputs, device: n.device })),
      tensors: parsed.tensors.map((t) => ({ name: t.name, kind: t.kind, dtype: t.dtype, shape: t.shape })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportTfSchemaCsv(dataset: TfDataset): string {
  const lines = ['kind,name,op,inputs,device,shape'];
  for (const n of dataset.nodes) {
    lines.push(['node', csv(n.name), csv(n.op), csv(n.inputs.join('|')), csv(n.device), ''].join(','));
  }
  for (const t of dataset.tensors) {
    lines.push(['tensor', csv(t.name), csv(t.dtype), '', '', csv(t.shapeLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportTfRowsCsv(dataset: TfDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveTfSuggestion(state: { hasFiles: boolean; hasError: boolean }): TfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker TensorFlow sample',
      reason: 'Load a tiny Placeholder → MatMul → Relu → Softmax ranking graph with weight tensors.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a TensorFlow graph',
      reason: 'Drop a .pb / .pbtxt GraphDef, JSON dump, or CSV node list — or load the sample ranker.',
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
