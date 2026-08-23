import { EG_MAX_FILE_BYTES, EG_SUPPORTED_EXTENSIONS } from '../constants/eagle-pcb-viewer.constants';
import type { EgBoardItem, EgDataset, EgLayer, EgLoadedFile, EgMetadataRow, EgNet, EgSchItem, EgSuggestion } from '../types/eagle-pcb-viewer.types';
import { buildSampleEgBytes, parseEgBytes } from './eagle-pcb-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatEgFileSize,
  readFileBytes as readEgFileBytes
} from './cad-file.utils';

export {
  buildSampleEgBytes,
  buildSampleEgJson,
  filterEgBoardItems,
  filterEgLayers,
  filterEgNets,
  filterEgRows,
  filterEgSchItems,
  parseEgBytes,
  parseEgText
} from './eagle-pcb-viewer-parse.utils';
export { egTypeColor, renderEgBoard, renderEgPreview, renderEgSch, renderEgStack, toEgBoardGeom, toEgSchGeom } from './eagle-pcb-viewer-render.utils';

export function isSupportedEgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (EG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateEgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > EG_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(EG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidEgFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: EG_SUPPORTED_EXTENSIONS,
    maxBytes: EG_MAX_FILE_BYTES,
    formatsLabel: '.brd, .sch, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Eagle files are not supported — decompress first'
  });
}

export function createSampleEgFile(): File {
  return new File([cadBytesToBlobPart(buildSampleEgBytes())], 'arduino-shield.brd', { type: 'application/x-eagle', lastModified: 0 });
}

export function createEgFileRecord(file: File, bytes: Uint8Array): EgLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: EgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseEgBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.nets.length && !parsed.boardItems.length && !parsed.schItems.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Eagle dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportEg(file: EgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildEgMetadataRows(dataset: EgDataset): EgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Eagle', value: dataset.eagleVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Stack', value: String(dataset.layerCount) },
    { key: 'Nets', value: String(dataset.netCount) },
    { key: 'Board', value: String(dataset.boardCount) },
    { key: 'Schematic', value: String(dataset.schCount) }
  ];
}

export function buildEgLayerMetadata(layer: EgLayer): EgMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Stack', value: String(layer.stackIndex) },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Items', value: String(layer.itemCount) }
  ];
}

export function buildEgNetMetadata(net: EgNet): EgMetadataRow[] {
  return [
    { key: 'Name', value: net.name },
    { key: 'Class', value: net.netClass },
    { key: 'Items', value: String(net.itemCount) }
  ];
}

export function buildEgBoardMetadata(item: EgBoardItem): EgMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Type', value: item.type },
    { key: 'Layer', value: item.layer },
    { key: 'Net', value: item.net || '—' },
    { key: 'X', value: String(item.x) },
    { key: 'Y', value: String(item.y) },
    { key: 'X2', value: String(item.x2) },
    { key: 'Y2', value: String(item.y2) },
    { key: 'R', value: item.r ? String(item.r) : '—' },
    { key: 'Width', value: item.width ? String(item.width) : '—' },
    { key: 'Text', value: item.text || '—' }
  ];
}

export function buildEgSchMetadata(item: EgSchItem): EgMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Type', value: item.type },
    { key: 'Net', value: item.net || '—' },
    { key: 'X', value: String(item.x) },
    { key: 'Y', value: String(item.y) },
    { key: 'X2', value: String(item.x2) },
    { key: 'Y2', value: String(item.y2) },
    { key: 'R', value: item.r ? String(item.r) : '—' },
    { key: 'Text', value: item.text || '—' }
  ];
}

export function exportEgSummaryJson(file: EgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Eagle dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      eagleVer: parsed.eagleVer,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({
        name: l.name,
        function: l.function,
        stackIndex: l.stackIndex,
        color: l.color,
        visible: l.visible,
        itemCount: l.itemCount
      })),
      nets: parsed.nets.map((n) => ({ name: n.name, netClass: n.netClass, itemCount: n.itemCount })),
      boardItems: parsed.boardItems.map((t) => ({
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
      schItems: parsed.schItems.map((t) => ({
        name: t.name,
        type: t.type,
        net: t.net,
        x: t.x,
        y: t.y,
        x2: t.x2,
        y2: t.y2,
        r: t.r,
        text: t.text,
        points: t.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportEgSchemaCsv(dataset: EgDataset): string {
  const lines = ['kind,name,type,layer,net,x'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), csv(layer.function), csv(layer.name), '', ''].join(','));
  }
  for (const net of dataset.nets) {
    lines.push(['net', csv(net.name), csv(net.netClass), '', csv(net.name), ''].join(','));
  }
  for (const item of dataset.boardItems) {
    lines.push(['board', csv(item.name), csv(item.type), csv(item.layer), csv(item.net), String(item.x)].join(','));
  }
  for (const item of dataset.schItems) {
    lines.push(['schematic', csv(item.name), csv(item.type), '', csv(item.net), String(item.x)].join(','));
  }
  return lines.join('\n');
}

export function exportEgRowsCsv(dataset: EgDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveEgSuggestion(state: { hasFiles: boolean; hasError: boolean }): EgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Eagle sample',
      reason: 'Load a tiny board + schematic dump with Top/Bottom, GND/VCC, wires, and U1.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an Eagle board',
      reason: 'Drop an ASCII .brd / .sch, JSON, or CSV — or load the sample shop floor.',
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
