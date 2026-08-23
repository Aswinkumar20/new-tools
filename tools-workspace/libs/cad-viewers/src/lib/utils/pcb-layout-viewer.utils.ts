import { PB_MAX_FILE_BYTES, PB_SUPPORTED_EXTENSIONS } from '../constants/pcb-layout-viewer.constants';
import type { PbDataset, PbLayer, PbLoadedFile, PbMetadataRow, PbNet, PbSuggestion, PbTrace } from '../types/pcb-layout-viewer.types';
import { buildSamplePbBytes, parsePbBytes } from './pcb-layout-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatPbFileSize,
  readFileBytes as readPbFileBytes
} from './cad-file.utils';

export {
  buildSamplePbBytes,
  buildSamplePbJson,
  filterPbLayers,
  filterPbNets,
  filterPbRows,
  filterPbTraces,
  parsePbBytes,
  parsePbText
} from './pcb-layout-viewer-parse.utils';
export { pbTypeColor, renderPbNets, renderPbPlot, renderPbPreview, renderPbStack, toCadGeom } from './pcb-layout-viewer-render.utils';

export function isSupportedPbFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PB_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validatePbFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PB_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(PB_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPbFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: PB_SUPPORTED_EXTENSIONS,
    maxBytes: PB_MAX_FILE_BYTES,
    formatsLabel: '.pcb, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed PCB files are not supported — decompress first'
  });
}

export function createSamplePbFile(): File {
  return new File([cadBytesToBlobPart(buildSamplePbBytes())], 'sensor-board.pcb', { type: 'application/x-pcb', lastModified: 0 });
}

export function createPbFileRecord(file: File, bytes: Uint8Array): PbLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PbDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePbBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.nets.length && !parsed.traces.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PCB dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPb(file: PbLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPbMetadataRows(dataset: PbDataset): PbMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Board', value: dataset.boardVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Stack', value: String(dataset.layerCount) },
    { key: 'Nets', value: String(dataset.netCount) },
    { key: 'Traces', value: String(dataset.traceCount) }
  ];
}

export function buildPbLayerMetadata(layer: PbLayer): PbMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Stack', value: String(layer.stackIndex) },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Traces', value: String(layer.traceCount) }
  ];
}

export function buildPbNetMetadata(net: PbNet): PbMetadataRow[] {
  return [
    { key: 'Name', value: net.name },
    { key: 'Class', value: net.netClass },
    { key: 'Traces', value: String(net.traceCount) }
  ];
}

export function buildPbTraceMetadata(trace: PbTrace): PbMetadataRow[] {
  return [
    { key: 'Name', value: trace.name },
    { key: 'Type', value: trace.type },
    { key: 'Layer', value: trace.layer },
    { key: 'Net', value: trace.net || '—' },
    { key: 'X', value: String(trace.x) },
    { key: 'Y', value: String(trace.y) },
    { key: 'X2', value: String(trace.x2) },
    { key: 'Y2', value: String(trace.y2) },
    { key: 'R', value: trace.r ? String(trace.r) : '—' },
    { key: 'Width', value: trace.width ? String(trace.width) : '—' },
    { key: 'Text', value: trace.text || '—' }
  ];
}

export function exportPbSummaryJson(file: PbLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PCB dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      boardVer: parsed.boardVer,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({
        name: l.name,
        function: l.function,
        stackIndex: l.stackIndex,
        color: l.color,
        visible: l.visible,
        traceCount: l.traceCount
      })),
      nets: parsed.nets.map((n) => ({ name: n.name, netClass: n.netClass, traceCount: n.traceCount })),
      traces: parsed.traces.map((t) => ({
        name: t.name,
        type: t.type,
        layer: t.layer,
        net: t.net,
        x: t.x,
        y: t.y,
        x2: t.x2,
        y2: t.y2,
        r: t.r,
        width: t.width,
        text: t.text,
        points: t.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPbSchemaCsv(dataset: PbDataset): string {
  const lines = ['kind,name,type,layer,net,x'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), csv(layer.function), csv(layer.name), '', ''].join(','));
  }
  for (const net of dataset.nets) {
    lines.push(['net', csv(net.name), csv(net.netClass), '', csv(net.name), ''].join(','));
  }
  for (const trace of dataset.traces) {
    lines.push(['trace', csv(trace.name), csv(trace.type), csv(trace.layer), csv(trace.net), String(trace.x)].join(','));
  }
  return lines.join('\n');
}

export function exportPbRowsCsv(dataset: PbDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolvePbSuggestion(state: { hasFiles: boolean; hasError: boolean }): PbSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor PCB sample',
      reason: 'Load a tiny board dump with copper stack, GND/VCC nets, tracks, and a via.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PCB layout',
      reason: 'Drop an ASCII .pcb, JSON, or CSV — or load the sample shop floor.',
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
