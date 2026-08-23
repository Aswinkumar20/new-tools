import { DX_MAX_FILE_BYTES, DX_SUPPORTED_EXTENSIONS } from '../constants/dxf-viewer.constants';
import type { DxDataset, DxEntity, DxLayer, DxLoadedFile, DxMetadataRow, DxSuggestion } from '../types/dxf-viewer.types';
import { buildSampleDxBytes, parseDxBytes } from './dxf-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatDxFileSize,
  readFileBytes as readDxFileBytes
} from './cad-file.utils';

export {
  buildSampleDxBytes,
  buildSampleDxJson,
  filterDxEntities,
  filterDxLayers,
  filterDxRows,
  parseDxBytes,
  parseDxText
} from './dxf-viewer-parse.utils';
export { dxTypeColor, renderDxDrawing, renderDxLayers, renderDxPreview, toCadGeom } from './dxf-viewer-render.utils';

export function isSupportedDxFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DX_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateDxFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DX_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(DX_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDxFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: DX_SUPPORTED_EXTENSIONS,
    maxBytes: DX_MAX_FILE_BYTES,
    formatsLabel: '.dxf, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed DXF files are not supported — decompress first'
  });
}

export function createSampleDxFile(): File {
  return new File([cadBytesToBlobPart(buildSampleDxBytes())], 'bracket-plate.dxf', { type: 'application/dxf', lastModified: 0 });
}

export function createDxFileRecord(file: File, bytes: Uint8Array): DxLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DxDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDxBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DXF dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDx(file: DxLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDxMetadataRows(dataset: DxDataset): DxMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'ACADVER', value: dataset.acadVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Entities', value: String(dataset.entityCount) }
  ];
}

export function buildDxLayerMetadata(layer: DxLayer): DxMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Entities', value: String(layer.entityCount) }
  ];
}

export function buildDxEntityMetadata(entity: DxEntity): DxMetadataRow[] {
  return [
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Layer', value: entity.layer },
    { key: 'X', value: String(entity.x) },
    { key: 'Y', value: String(entity.y) },
    { key: 'X2', value: String(entity.x2) },
    { key: 'Y2', value: String(entity.y2) },
    { key: 'R', value: entity.r ? String(entity.r) : '—' },
    { key: 'Text', value: entity.text || '—' }
  ];
}

export function exportDxSummaryJson(file: DxLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DXF dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      acadVer: parsed.acadVer,
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
        points: e.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportDxSchemaCsv(dataset: DxDataset): string {
  const lines = ['kind,name,type,layer,x,y'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), 'layer', csv(layer.name), '', ''].join(','));
  }
  for (const entity of dataset.entities) {
    lines.push(['entity', csv(entity.name), csv(entity.type), csv(entity.layer), String(entity.x), String(entity.y)].join(','));
  }
  return lines.join('\n');
}

export function exportDxRowsCsv(dataset: DxDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveDxSuggestion(state: { hasFiles: boolean; hasError: boolean }): DxSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor DXF sample',
      reason: 'Load a tiny ASCII DXF with WALLS, a counter polyline, and a column circle.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DXF drawing',
      reason: 'Drop an ASCII .dxf, JSON, or CSV — or load the sample shop floor.',
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
