import { OX_MAX_FILE_BYTES, OX_SUPPORTED_EXTENSIONS } from '../constants/onnx-viewer.constants';
import type { OxDataset, OxLoadedFile, OxMetadataRow, OxNode, OxSuggestion, OxTensor } from '../types/onnx-viewer.types';
import { buildSampleOnnxBytes, parseOnnxBytes } from './onnx-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatOxFileSize,
  readFileBytes as readOxFileBytes
} from './ml-file.utils';

export {
  buildSampleOnnxBytes,
  buildSampleOnnxJson,
  filterOxNodes,
  filterOxRows,
  filterOxTensors,
  parseOnnxBytes,
  parseOnnxText
} from './onnx-viewer-parse.utils';
export { oxTypeColor, renderOxGraph, renderOxPreview, renderOxTensors } from './onnx-viewer-render.utils';

export function isSupportedOxFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (OX_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateOxFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > OX_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(OX_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidOxFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed ONNX files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedOxFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .onnx, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateOxFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleOxFile(): File {
  return new File([buildSampleOnnxBytes() as BlobPart], 'sample-shop-ranker.onnx', { type: 'application/octet-stream', lastModified: 0 });
}

export function createOxFileRecord(file: File, bytes: Uint8Array): OxLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: OxDataset | null = null;
  let softFail = false;
  try {
    parsed = parseOnnxBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length && !parsed.tensors.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse ONNX');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportOx(file: OxLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildOxMetadataRows(dataset: OxDataset): OxMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'IR', value: dataset.irVersion },
    { key: 'Producer', value: dataset.producerName },
    { key: 'Opset', value: dataset.opset },
    { key: 'Ops', value: String(dataset.nodeCount) },
    { key: 'Tensors', value: String(dataset.tensorCount) }
  ];
}

export function buildOxNodeMetadata(node: OxNode): OxMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Op', value: node.opType },
    { key: 'Domain', value: node.domain || '—' },
    { key: 'Inputs', value: node.inputs.join(', ') || '—' },
    { key: 'Outputs', value: node.outputs.join(', ') || '—' }
  ];
}

export function buildOxTensorMetadata(tensor: OxTensor): OxMetadataRow[] {
  return [
    { key: 'Name', value: tensor.name },
    { key: 'Kind', value: tensor.kind },
    { key: 'DType', value: tensor.dtype },
    { key: 'Shape', value: tensor.shapeLabel },
    { key: 'Size', value: String(tensor.size) },
    { key: 'Preview', value: tensor.preview || '—' }
  ];
}

export function exportOxSummaryJson(file: OxLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ONNX model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      irVersion: parsed.irVersion,
      producerName: parsed.producerName,
      opset: parsed.opset,
      nodes: parsed.nodes.map((n) => ({ name: n.name, opType: n.opType, inputs: n.inputs, outputs: n.outputs })),
      tensors: parsed.tensors.map((t) => ({ name: t.name, kind: t.kind, dtype: t.dtype, shape: t.shape })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportOxSchemaCsv(dataset: OxDataset): string {
  const lines = ['kind,name,type,inputs,outputs,shape'];
  for (const n of dataset.nodes) {
    lines.push(['op', csv(n.name), csv(n.opType), csv(n.inputs.join('|')), csv(n.outputs.join('|')), ''].join(','));
  }
  for (const t of dataset.tensors) {
    lines.push(['tensor', csv(t.name), csv(t.dtype), '', '', csv(t.shapeLabel)].join(','));
  }
  return lines.join('\n');
}

export function exportOxRowsCsv(dataset: OxDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveOxSuggestion(state: { hasFiles: boolean; hasError: boolean }): OxSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker ONNX sample',
      reason: 'Load a tiny Gemm → Relu → Gemm → Softmax ranking graph with weight tensors.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an ONNX model',
      reason: 'Drop a .onnx file, JSON dump, or CSV op list — or load the sample ranker.',
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
