import { GB_MAX_FILE_BYTES, GB_SUPPORTED_EXTENSIONS } from '../constants/gerber-file-viewer.constants';
import type { GbDataset, GbFeature, GbLayer, GbLoadedFile, GbMetadataRow, GbSuggestion } from '../types/gerber-file-viewer.types';
import { buildSampleGbBytes, parseGbBytes } from './gerber-file-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatGbFileSize,
  readFileBytes as readGbFileBytes
} from './cad-file.utils';

export {
  buildSampleGbBytes,
  buildSampleGbJson,
  filterGbFeatures,
  filterGbLayers,
  filterGbRows,
  parseGbBytes,
  parseGbText
} from './gerber-file-viewer-parse.utils';
export { gbTypeColor, renderGbArtwork, renderGbLayers, renderGbPreview, toCadGeom } from './gerber-file-viewer-render.utils';

export function isSupportedGbFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GB_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateGbFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GB_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(GB_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGbFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: GB_SUPPORTED_EXTENSIONS,
    maxBytes: GB_MAX_FILE_BYTES,
    formatsLabel: '.gbr, .ger, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Gerber files are not supported — decompress first'
  });
}

export function createSampleGbFile(): File {
  return new File([cadBytesToBlobPart(buildSampleGbBytes())], 'rf-shield.gbr', { type: 'application/vnd.gerber', lastModified: 0 });
}

export function createGbFileRecord(file: File, bytes: Uint8Array): GbLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: GbDataset | null = null;
  let softFail = false;
  try {
    parsed = parseGbBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.features.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Gerber dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportGb(file: GbLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGbMetadataRows(dataset: GbDataset): GbMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Gerber', value: dataset.gerberVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Features', value: String(dataset.featureCount) }
  ];
}

export function buildGbLayerMetadata(layer: GbLayer): GbMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Function', value: layer.function },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Features', value: String(layer.featureCount) }
  ];
}

export function buildGbFeatureMetadata(feature: GbFeature): GbMetadataRow[] {
  return [
    { key: 'Name', value: feature.name },
    { key: 'Type', value: feature.type },
    { key: 'Layer', value: feature.layer },
    { key: 'Polarity', value: feature.polarity },
    { key: 'X', value: String(feature.x) },
    { key: 'Y', value: String(feature.y) },
    { key: 'X2', value: String(feature.x2) },
    { key: 'Y2', value: String(feature.y2) },
    { key: 'R', value: feature.r ? String(feature.r) : '—' },
    { key: 'Text', value: feature.text || '—' }
  ];
}

export function exportGbSummaryJson(file: GbLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Gerber dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      gerberVer: parsed.gerberVer,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({ name: l.name, function: l.function, color: l.color, visible: l.visible, featureCount: l.featureCount })),
      features: parsed.features.map((f) => ({
        name: f.name,
        type: f.type,
        layer: f.layer,
        polarity: f.polarity,
        x: f.x,
        y: f.y,
        x2: f.x2,
        y2: f.y2,
        r: f.r,
        text: f.text,
        points: f.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportGbSchemaCsv(dataset: GbDataset): string {
  const lines = ['kind,name,type,layer,x,y'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), csv(layer.function), csv(layer.name), '', ''].join(','));
  }
  for (const feature of dataset.features) {
    lines.push(['feature', csv(feature.name), csv(feature.type), csv(feature.layer), String(feature.x), String(feature.y)].join(','));
  }
  return lines.join('\n');
}

export function exportGbRowsCsv(dataset: GbDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveGbSuggestion(state: { hasFiles: boolean; hasError: boolean }): GbSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Gerber sample',
      reason: 'Load a tiny RS-274X dump with copper, silk, mask, and a via flash.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Gerber file',
      reason: 'Drop an ASCII .gbr/.ger, JSON, or CSV — or load the sample shop floor.',
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
