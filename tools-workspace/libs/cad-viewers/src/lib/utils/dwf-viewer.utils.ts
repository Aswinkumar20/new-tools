import { WF_MAX_FILE_BYTES, WF_SUPPORTED_EXTENSIONS } from '../constants/dwf-viewer.constants';
import type { WfDataset, WfEntity, WfLayer, WfLoadedFile, WfMetadataRow, WfSheet, WfSuggestion } from '../types/dwf-viewer.types';
import { buildSampleWfBytes, parseWfBytes } from './dwf-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatWfFileSize,
  readFileBytes as readWfFileBytes
} from './cad-file.utils';

export {
  buildSampleWfBytes,
  buildSampleWfJson,
  filterWfEntities,
  filterWfLayers,
  filterWfRows,
  filterWfSheets,
  parseWfBytes,
  parseWfText
} from './dwf-viewer-parse.utils';
export { renderWfDrawing, renderWfLayers, renderWfSheets, toCadGeom, wfTypeColor } from './dwf-viewer-render.utils';

export function isSupportedWfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (WF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateWfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > WF_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(WF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidWfFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: WF_SUPPORTED_EXTENSIONS,
    maxBytes: WF_MAX_FILE_BYTES,
    formatsLabel: '.dwf, .dwfx, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed DWF files are not supported — decompress first'
  });
}

export function createSampleWfFile(): File {
  return new File([cadBytesToBlobPart(buildSampleWfBytes())], 'permit-set.dwf', { type: 'model/vnd.dwf', lastModified: 0 });
}

export function createWfFileRecord(file: File, bytes: Uint8Array): WfLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: WfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseWfBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.sheets.length && !parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DWF dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportWf(file: WfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildWfMetadataRows(dataset: WfDataset): WfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Sheets', value: String(dataset.sheetCount) },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Entities', value: String(dataset.entityCount) }
  ];
}

export function buildWfSheetMetadata(sheet: WfSheet): WfMetadataRow[] {
  return [
    { key: 'Name', value: sheet.name },
    { key: 'Size', value: `${sheet.width} × ${sheet.height}` },
    { key: 'Entities', value: String(sheet.entityCount) }
  ];
}

export function buildWfLayerMetadata(layer: WfLayer): WfMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Entities', value: String(layer.entityCount) }
  ];
}

export function buildWfEntityMetadata(entity: WfEntity): WfMetadataRow[] {
  return [
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Sheet', value: entity.sheet },
    { key: 'Layer', value: entity.layer },
    { key: 'X', value: String(entity.x) },
    { key: 'Y', value: String(entity.y) },
    { key: 'Text', value: entity.text || '—' }
  ];
}

export function exportWfSummaryJson(file: WfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DWF dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      sheets: parsed.sheets.map((s) => ({ name: s.name, width: s.width, height: s.height, entityCount: s.entityCount })),
      layers: parsed.layers.map((l) => ({ name: l.name, color: l.color, visible: l.visible, entityCount: l.entityCount })),
      entities: parsed.entities.map((e) => ({
        name: e.name,
        type: e.type,
        sheet: e.sheet,
        layer: e.layer,
        x: e.x,
        y: e.y,
        x2: e.x2,
        y2: e.y2,
        r: e.r,
        text: e.text
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportWfSchemaCsv(dataset: WfDataset): string {
  const lines = ['kind,name,type,sheet,layer,value'];
  for (const sheet of dataset.sheets) {
    lines.push(['sheet', csv(sheet.name), 'sheet', csv(sheet.name), '', `${sheet.width}x${sheet.height}`].join(','));
  }
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), 'layer', '', csv(layer.name), String(layer.entityCount)].join(','));
  }
  for (const entity of dataset.entities) {
    lines.push(['entity', csv(entity.name), csv(entity.type), csv(entity.sheet), csv(entity.layer), csv(entity.text || '')].join(','));
  }
  return lines.join('\n');
}

export function exportWfRowsCsv(dataset: WfDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveWfSuggestion(state: { hasFiles: boolean; hasError: boolean }): WfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor DWF sample',
      reason: 'Load a tiny published Cover + Plan dump with WALLS, fixtures, and a review markup.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DWF publish dump',
      reason: 'Drop a .dwf / .dwfx dump, JSON, or CSV — or load the sample shop floor publish.',
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
