import { NN_MAX_FILE_BYTES, NN_SUPPORTED_EXTENSIONS } from '../constants/neural-network-graph-viewer.constants';
import type { NnConnection, NnDataset, NnLayer, NnLoadedFile, NnMetadataRow, NnSuggestion } from '../types/neural-network-graph-viewer.types';
import { buildSampleNnBytes, parseNnBytes } from './neural-network-graph-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatNnFileSize,
  readFileBytes as readNnFileBytes
} from './ml-file.utils';

export {
  buildSampleNnBytes,
  buildSampleNnJson,
  filterNnConnections,
  filterNnLayers,
  filterNnRows,
  parseNnBytes,
  parseNnText
} from './neural-network-graph-viewer-parse.utils';
export { nnTypeColor, renderNnConnections, renderNnLayers, renderNnPreview } from './neural-network-graph-viewer-render.utils';

export function isSupportedNnFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (NN_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateNnFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NN_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(NN_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidNnFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed NN graphs are not supported — decompress first' });
      continue;
    }
    if (!isSupportedNnFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .nn, .graph, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateNnFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNnFile(): File {
  return new File([buildSampleNnBytes() as BlobPart], 'sample-shop-ranker.nn', { type: 'application/octet-stream', lastModified: 0 });
}

export function createNnFileRecord(file: File, bytes: Uint8Array): NnLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: NnDataset | null = null;
  let softFail = false;
  try {
    parsed = parseNnBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.connections.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse neural network graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportNn(file: NnLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildNnMetadataRows(dataset: NnDataset): NnMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Framework', value: dataset.framework },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Connections', value: String(dataset.connectionCount) }
  ];
}

export function buildNnLayerMetadata(layer: NnLayer): NnMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Type', value: layer.type },
    { key: 'Units', value: layer.units || '—' },
    { key: 'Activation', value: layer.activation || '—' }
  ];
}

export function buildNnConnectionMetadata(conn: NnConnection): NnMetadataRow[] {
  return [
    { key: 'Source', value: conn.source },
    { key: 'Target', value: conn.target },
    { key: 'Label', value: conn.label || '—' },
    { key: 'Weight', value: conn.weight || '—' }
  ];
}

export function exportNnSummaryJson(file: NnLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed neural network graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      framework: parsed.framework,
      layers: parsed.layers.map((l) => ({ name: l.name, type: l.type, units: l.units, activation: l.activation })),
      connections: parsed.connections.map((c) => ({ source: c.source, target: c.target, label: c.label, weight: c.weight })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportNnSchemaCsv(dataset: NnDataset): string {
  const lines = ['kind,name,type,source,target,units'];
  for (const l of dataset.layers) {
    lines.push(['layer', csv(l.name), csv(l.type), '', '', csv(l.units)].join(','));
  }
  for (const c of dataset.connections) {
    lines.push(['connection', csv(c.label || `${c.source}->${c.target}`), '', csv(c.source), csv(c.target), ''].join(','));
  }
  return lines.join('\n');
}

export function exportNnRowsCsv(dataset: NnDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveNnSuggestion(state: { hasFiles: boolean; hasError: boolean }): NnSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker NN graph sample',
      reason: 'Load a tiny Input → Linear → ReLU → Linear → Softmax ranking graph.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a neural network graph',
      reason: 'Drop a .nn / JSON dump or CSV layer list — or load the sample ranker.',
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
