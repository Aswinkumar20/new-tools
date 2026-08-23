import { KC_MAX_FILE_BYTES, KC_SUPPORTED_EXTENSIONS } from '../constants/kicad-viewer.constants';
import type { KcBoardItem, KcDataset, KcLayer, KcLoadedFile, KcMetadataRow, KcNet, KcSchItem, KcSuggestion } from '../types/kicad-viewer.types';
import { buildSampleKcBytes, parseKcBytes } from './kicad-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatKcFileSize,
  readFileBytes as readKcFileBytes
} from './cad-file.utils';

export {
  buildSampleKcBytes,
  buildSampleKcJson,
  filterKcBoardItems,
  filterKcLayers,
  filterKcNets,
  filterKcRows,
  filterKcSchItems,
  parseKcBytes,
  parseKcText
} from './kicad-viewer-parse.utils';
export { kcTypeColor, renderKcBoard, renderKcPreview, renderKcSch, renderKcStack, toKcBoardGeom, toKcSchGeom } from './kicad-viewer-render.utils';

export function getKcFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.kicad_pcb')) return '.kicad_pcb';
  if (lower.endsWith('.kicad_sch')) return '.kicad_sch';
  if (lower.endsWith('.kicad_pro')) return '.kicad_pro';
  return getCadFileExtension(fileName);
}

export function isSupportedKcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (KC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getKcFileExtension(file.name));
}

export function validateKcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > KC_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(KC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidKcFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: KC_SUPPORTED_EXTENSIONS,
    maxBytes: KC_MAX_FILE_BYTES,
    formatsLabel: '.kicad_pcb, .kicad_sch, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed KiCad files are not supported — decompress first'
  });
}

export function createSampleKcFile(): File {
  return new File([cadBytesToBlobPart(buildSampleKcBytes())], 'nucleo-hat.kicad_pcb', { type: 'application/x-kicad', lastModified: 0 });
}

export function createKcFileRecord(file: File, bytes: Uint8Array): KcLoadedFile {
  const extension = getKcFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: KcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseKcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.nets.length && !parsed.boardItems.length && !parsed.schItems.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse KiCad dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportKc(file: KcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildKcMetadataRows(dataset: KcDataset): KcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'KiCad', value: dataset.kicadVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Stack', value: String(dataset.layerCount) },
    { key: 'Nets', value: String(dataset.netCount) },
    { key: 'Board', value: String(dataset.boardCount) },
    { key: 'Schematic', value: String(dataset.schCount) }
  ];
}

export function buildKcLayerMetadata(layer: KcLayer): KcMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Stack', value: String(layer.stackIndex) },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Items', value: String(layer.itemCount) }
  ];
}

export function buildKcNetMetadata(net: KcNet): KcMetadataRow[] {
  return [
    { key: 'Name', value: net.name },
    { key: 'Class', value: net.netClass },
    { key: 'Items', value: String(net.itemCount) }
  ];
}

export function buildKcBoardMetadata(item: KcBoardItem): KcMetadataRow[] {
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

export function buildKcSchMetadata(item: KcSchItem): KcMetadataRow[] {
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

export function exportKcSummaryJson(file: KcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed KiCad dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      kicadVer: parsed.kicadVer,
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

export function exportKcSchemaCsv(dataset: KcDataset): string {
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

export function exportKcRowsCsv(dataset: KcDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveKcSuggestion(state: { hasFiles: boolean; hasError: boolean }): KcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor KiCad sample',
      reason: 'Load a tiny board + schematic dump with F.Cu/B.Cu, GND/VCC, tracks, and U1.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a KiCad project',
      reason: 'Drop an ASCII .kicad_pcb / .kicad_sch, JSON, or CSV — or load the sample shop floor.',
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
