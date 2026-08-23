import { HG_MAX_FILE_BYTES, HG_SUPPORTED_EXTENSIONS } from '../constants/hpgl-viewer.constants';
import type { HgCommand, HgDataset, HgLayer, HgLoadedFile, HgMetadataRow, HgSuggestion } from '../types/hpgl-viewer.types';
import { buildSampleHgBytes, parseHgBytes } from './hpgl-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatHgFileSize,
  readFileBytes as readHgFileBytes
} from './cad-file.utils';

export {
  buildSampleHgBytes,
  buildSampleHgJson,
  filterHgCommands,
  filterHgLayers,
  filterHgRows,
  parseHgBytes,
  parseHgText
} from './hpgl-viewer-parse.utils';
export { hgTypeColor, renderHgLayers, renderHgPlot, renderHgPreview, toCadGeom } from './hpgl-viewer-render.utils';

export function isSupportedHgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (HG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateHgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > HG_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(HG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidHgFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: HG_SUPPORTED_EXTENSIONS,
    maxBytes: HG_MAX_FILE_BYTES,
    formatsLabel: '.hpgl, .hgl, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed HPGL files are not supported — decompress first'
  });
}

export function createSampleHgFile(): File {
  return new File([cadBytesToBlobPart(buildSampleHgBytes())], 'outline-plot.hpgl', { type: 'application/vnd.hp-hpgl', lastModified: 0 });
}

export function createHgFileRecord(file: File, bytes: Uint8Array): HgLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: HgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseHgBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.commands.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse HPGL dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportHg(file: HgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildHgMetadataRows(dataset: HgDataset): HgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Plotter', value: dataset.plotterVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Commands', value: String(dataset.commandCount) }
  ];
}

export function buildHgLayerMetadata(layer: HgLayer): HgMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Commands', value: String(layer.commandCount) }
  ];
}

export function buildHgCommandMetadata(command: HgCommand): HgMetadataRow[] {
  return [
    { key: 'Name', value: command.name },
    { key: 'Type', value: command.type },
    { key: 'Layer', value: command.layer },
    { key: 'X', value: String(command.x) },
    { key: 'Y', value: String(command.y) },
    { key: 'X2', value: String(command.x2) },
    { key: 'Y2', value: String(command.y2) },
    { key: 'R', value: command.r ? String(command.r) : '—' },
    { key: 'Text', value: command.text || '—' }
  ];
}

export function exportHgSummaryJson(file: HgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HPGL dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      plotterVer: parsed.plotterVer,
      units: parsed.units,
      layers: parsed.layers.map((l) => ({ name: l.name, color: l.color, visible: l.visible, commandCount: l.commandCount })),
      commands: parsed.commands.map((c) => ({
        name: c.name,
        type: c.type,
        layer: c.layer,
        x: c.x,
        y: c.y,
        x2: c.x2,
        y2: c.y2,
        r: c.r,
        text: c.text,
        points: c.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportHgSchemaCsv(dataset: HgDataset): string {
  const lines = ['kind,name,type,layer,x,y'];
  for (const layer of dataset.layers) {
    lines.push(['layer', csv(layer.name), 'layer', csv(layer.name), '', ''].join(','));
  }
  for (const command of dataset.commands) {
    lines.push(['command', csv(command.name), csv(command.type), csv(command.layer), String(command.x), String(command.y)].join(','));
  }
  return lines.join('\n');
}

export function exportHgRowsCsv(dataset: HgDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveHgSuggestion(state: { hasFiles: boolean; hasError: boolean }): HgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor HPGL sample',
      reason: 'Load a tiny HP-GL plot with WALLS, a counter polyline, and a column circle.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an HPGL plot',
      reason: 'Drop an ASCII .hpgl/.hgl, JSON, or CSV — or load the sample shop floor.',
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
