import { AL_MAX_FILE_BYTES, AL_SUPPORTED_EXTENSIONS } from '../constants/altium-pcb-viewer.constants';
import type { AlCopper, AlDataset, AlDesignator, AlLayer, AlLoadedFile, AlMetadataRow, AlNet, AlSuggestion } from '../types/altium-pcb-viewer.types';
import { buildSampleAlBytes, parseAlBytes } from './altium-pcb-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatAlFileSize,
  readFileBytes as readAlFileBytes
} from './cad-file.utils';

export {
  buildSampleAlBytes,
  buildSampleAlJson,
  filterAlCoppers,
  filterAlDesignators,
  filterAlLayers,
  filterAlNets,
  filterAlRows,
  parseAlBytes,
  parseAlText
} from './altium-pcb-viewer-parse.utils';
export { alTypeColor, renderAlCopper, renderAlDes, renderAlStack, toAlCopperGeom, toAlDesGeom } from './altium-pcb-viewer-render.utils';

export function isSupportedAlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (AL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateAlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > AL_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(AL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidAlFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: AL_SUPPORTED_EXTENSIONS,
    maxBytes: AL_MAX_FILE_BYTES,
    formatsLabel: '.pcbdoc, .schdoc, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Altium files are not supported — decompress first'
  });
}

export function createSampleAlFile(): File {
  return new File([cadBytesToBlobPart(buildSampleAlBytes())], 'power-module.pcbdoc', { type: 'application/x-altium', lastModified: 0 });
}

export function createAlFileRecord(file: File, bytes: Uint8Array): AlLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: AlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseAlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.nets.length && !parsed.coppers.length && !parsed.designators.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Altium dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportAl(file: AlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildAlMetadataRows(dataset: AlDataset): AlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Altium', value: dataset.altiumVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Stack', value: String(dataset.layerCount) },
    { key: 'Nets', value: String(dataset.netCount) },
    { key: 'Copper', value: String(dataset.copperCount) },
    { key: 'Designators', value: String(dataset.desCount) }
  ];
}

export function buildAlLayerMetadata(layer: AlLayer): AlMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Stack', value: String(layer.stackIndex) },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Items', value: String(layer.itemCount) }
  ];
}

export function buildAlNetMetadata(net: AlNet): AlMetadataRow[] {
  return [
    { key: 'Name', value: net.name },
    { key: 'Class', value: net.netClass },
    { key: 'Items', value: String(net.itemCount) }
  ];
}

export function buildAlCopperMetadata(item: AlCopper): AlMetadataRow[] {
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
    { key: 'Width', value: item.width ? String(item.width) : '—' }
  ];
}

export function buildAlDesMetadata(item: AlDesignator): AlMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Type', value: item.type },
    { key: 'Layer', value: item.layer || '—' },
    { key: 'Net', value: item.net || '—' },
    { key: 'X', value: String(item.x) },
    { key: 'Y', value: String(item.y) },
    { key: 'Text', value: item.text || '—' }
  ];
}

export function exportAlSummaryJson(file: AlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Altium dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      altiumVer: parsed.altiumVer,
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
      coppers: parsed.coppers.map((t) => ({
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
        points: t.points
      })),
      designators: parsed.designators.map((t) => ({
        name: t.name,
        type: t.type,
        layer: t.layer,
        net: t.net,
        x: t.x,
        y: t.y,
        text: t.text
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportAlSchemaCsv(dataset: AlDataset): string {
  const lines = ['kind,name,type,layer,net,x'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), csv(layer.function), csv(layer.name), '', ''].join(','));
  }
  for (const net of dataset.nets) {
    lines.push(['net', csv(net.name), csv(net.netClass), '', csv(net.name), ''].join(','));
  }
  for (const item of dataset.coppers) {
    lines.push(['copper', csv(item.name), csv(item.type), csv(item.layer), csv(item.net), String(item.x)].join(','));
  }
  for (const item of dataset.designators) {
    lines.push(['designator', csv(item.name), csv(item.type), csv(item.layer), csv(item.net), String(item.x)].join(','));
  }
  return lines.join('\n');
}

export function exportAlRowsCsv(dataset: AlDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveAlSuggestion(state: { hasFiles: boolean; hasError: boolean }): AlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Altium sample',
      reason: 'Load a tiny dump with TopLayer copper, GND/VCC, tracks, and U1 designator.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an Altium PCB',
      reason: 'Drop an ASCII .pcbdoc dump, JSON, or CSV — or load the sample shop floor.',
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
