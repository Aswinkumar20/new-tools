import { DW_MAX_FILE_BYTES, DW_SUPPORTED_EXTENSIONS } from '../constants/dwg-viewer.constants';
import type { DwDataset, DwEntity, DwLayer, DwLoadedFile, DwMeasurement, DwMetadataRow, DwSuggestion } from '../types/dwg-viewer.types';
import { buildSampleDwBytes, parseDwBytes } from './dwg-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatDwFileSize,
  readFileBytes as readDwFileBytes
} from './cad-file.utils';

export {
  buildSampleDwBytes,
  buildSampleDwJson,
  filterDwEntities,
  filterDwLayers,
  filterDwMeasurements,
  filterDwRows,
  parseDwBytes,
  parseDwText
} from './dwg-viewer-parse.utils';
export { dwTypeColor, renderDwDrawing, renderDwLayers, renderDwPreview, toCadGeom } from './dwg-viewer-render.utils';

export function isSupportedDwFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DW_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateDwFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DW_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(DW_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDwFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: DW_SUPPORTED_EXTENSIONS,
    maxBytes: DW_MAX_FILE_BYTES,
    formatsLabel: '.dwg, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed DWG files are not supported — decompress first'
  });
}

export function createSampleDwFile(): File {
  return new File([cadBytesToBlobPart(buildSampleDwBytes())], 'office-l2.dwg', { type: 'application/octet-stream', lastModified: 0 });
}

export function createDwFileRecord(file: File, bytes: Uint8Array): DwLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DwDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDwBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DWG dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDw(file: DwLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDwMetadataRows(dataset: DwDataset): DwMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Entities', value: String(dataset.entityCount) },
    { key: 'Measurements', value: String(dataset.measurementCount) }
  ];
}

export function buildDwLayerMetadata(layer: DwLayer): DwMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Entities', value: String(layer.entityCount) }
  ];
}

export function buildDwMeasMetadata(meas: DwMeasurement): DwMetadataRow[] {
  return [
    { key: 'Name', value: meas.name },
    { key: 'Type', value: meas.type },
    { key: 'Layer', value: meas.layer },
    { key: 'Value', value: String(meas.value) },
    { key: 'Unit', value: meas.unit },
    { key: 'Label', value: meas.label || '—' }
  ];
}

export function buildDwEntityMetadata(entity: DwEntity): DwMetadataRow[] {
  return [
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Layer', value: entity.layer },
    { key: 'X', value: String(entity.x) },
    { key: 'Y', value: String(entity.y) },
    { key: 'Length', value: entity.length ? String(entity.length) : '—' },
    { key: 'Text', value: entity.text || '—' }
  ];
}

export function exportDwSummaryJson(file: DwLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DWG dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({ name: l.name, color: l.color, visible: l.visible, entityCount: l.entityCount })),
      entities: parsed.entities.map((e) => ({
        name: e.name,
        type: e.type,
        layer: e.layer,
        x: e.x,
        y: e.y,
        x2: e.x2,
        y2: e.y2,
        r: e.r,
        text: e.text,
        length: e.length
      })),
      measurements: parsed.measurements.map((m) => ({ name: m.name, type: m.type, layer: m.layer, value: m.value, unit: m.unit, label: m.label })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportDwSchemaCsv(dataset: DwDataset): string {
  const lines = ['kind,name,type,layer,length,value'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), 'layer', csv(layer.name), String(layer.entityCount), ''].join(','));
  }
  for (const entity of dataset.entities) {
    lines.push(['entity', csv(entity.name), csv(entity.type), csv(entity.layer), String(entity.length || ''), ''].join(','));
  }
  for (const meas of dataset.measurements) {
    lines.push(['measurement', csv(meas.name), csv(meas.type), csv(meas.layer), '', String(meas.value)].join(','));
  }
  return lines.join('\n');
}

export function exportDwRowsCsv(dataset: DwDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveDwSuggestion(state: { hasFiles: boolean; hasError: boolean }): DwSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor DWG sample',
      reason: 'Load a tiny 12×8 m shop dump with WALLS, fixtures, and measurements.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DWG dump',
      reason: 'Drop a .dwg dump, JSON, or CSV — or load the sample shop floor.',
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
