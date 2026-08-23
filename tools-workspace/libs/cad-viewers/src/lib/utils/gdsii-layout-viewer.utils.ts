import { GD_MAX_FILE_BYTES, GD_SUPPORTED_EXTENSIONS } from '../constants/gdsii-layout-viewer.constants';
import type { GdCell, GdDataset, GdFeature, GdLayer, GdLoadedFile, GdMetadataRow, GdSuggestion } from '../types/gdsii-layout-viewer.types';
import { buildSampleGdBytes, parseGdBytes } from './gdsii-layout-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatGdFileSize,
  readFileBytes as readGdFileBytes
} from './cad-file.utils';

export {
  buildSampleGdBytes,
  buildSampleGdJson,
  filterGdCells,
  filterGdFeatures,
  filterGdLayers,
  filterGdRows,
  parseGdBytes,
  parseGdText
} from './gdsii-layout-viewer-parse.utils';
export { gdTypeColor, renderGdPlot, renderGdStack, toGdFeatGeom } from './gdsii-layout-viewer-render.utils';

export function getGdFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.gdsii')) return '.gdsii';
  return getCadFileExtension(fileName);
}

export function isSupportedGdFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GD_SUPPORTED_EXTENSIONS as readonly string[]).includes(getGdFileExtension(file.name));
}

export function validateGdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GD_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(GD_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGdFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: GD_SUPPORTED_EXTENSIONS,
    maxBytes: GD_MAX_FILE_BYTES,
    formatsLabel: '.gds, .gdsii, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed GDSII files are not supported — decompress first'
  });
}

export function createSampleGdFile(): File {
  return new File([cadBytesToBlobPart(buildSampleGdBytes())], 'nand2-x1.gds', { type: 'application/x-gdsii', lastModified: 0 });
}

export function createGdFileRecord(file: File, bytes: Uint8Array): GdLoadedFile {
  const extension = getGdFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: GdDataset | null = null;
  let softFail = false;
  try {
    parsed = parseGdBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.cells.length && !parsed.features.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse GDSII dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportGd(file: GdLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGdMetadataRows(dataset: GdDataset): GdMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'GDSII', value: dataset.gdsVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Cells', value: String(dataset.cellCount) },
    { key: 'Features', value: String(dataset.featCount) }
  ];
}

export function buildGdLayerMetadata(layer: GdLayer): GdMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Stack', value: String(layer.stackIndex) },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Items', value: String(layer.itemCount) }
  ];
}

export function buildGdCellMetadata(cell: GdCell): GdMetadataRow[] {
  return [
    { key: 'Name', value: cell.name },
    { key: 'Items', value: String(cell.itemCount) }
  ];
}

export function buildGdFeatMetadata(item: GdFeature): GdMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Type', value: item.type },
    { key: 'Layer', value: item.layer },
    { key: 'Cell', value: item.cell || '—' },
    { key: 'X', value: String(item.x) },
    { key: 'Y', value: String(item.y) },
    { key: 'X2', value: String(item.x2) },
    { key: 'Y2', value: String(item.y2) },
    { key: 'R', value: item.r ? String(item.r) : '—' },
    { key: 'Width', value: item.width ? String(item.width) : '—' },
    { key: 'Text', value: item.text || '—' }
  ];
}

export function exportGdSummaryJson(file: GdLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GDSII dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      gdsVer: parsed.gdsVer,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({
        name: l.name,
        function: l.function,
        stackIndex: l.stackIndex,
        color: l.color,
        visible: l.visible,
        itemCount: l.itemCount
      })),
      cells: parsed.cells.map((c) => ({ name: c.name, itemCount: c.itemCount })),
      features: parsed.features.map((t) => ({
        name: t.name,
        type: t.type,
        layer: t.layer,
        cell: t.cell,
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

export function exportGdSchemaCsv(dataset: GdDataset): string {
  const lines = ['kind,name,type,layer,cell,x'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), csv(layer.function), csv(layer.name), '', ''].join(','));
  }
  for (const cell of dataset.cells) {
    lines.push(['cell', csv(cell.name), 'cell', '', csv(cell.name), ''].join(','));
  }
  for (const item of dataset.features) {
    lines.push(['plot', csv(item.name), csv(item.type), csv(item.layer), csv(item.cell), String(item.x)].join(','));
  }
  return lines.join('\n');
}

export function exportGdRowsCsv(dataset: GdDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveGdSuggestion(state: { hasFiles: boolean; hasError: boolean }): GdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor GDSII sample',
      reason: 'Load a tiny dump with metal/poly layers, TOP cell, and ShopRanker text.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a GDSII layout',
      reason: 'Drop an ASCII .gds dump, JSON, or CSV — or load the sample shop floor.',
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
