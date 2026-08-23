import { DG_MAX_FILE_BYTES, DG_SUPPORTED_EXTENSIONS } from '../constants/dgn-viewer.constants';
import type { DgCivil, DgDataset, DgEntity, DgLayer, DgLoadedFile, DgMetadataRow, DgSuggestion } from '../types/dgn-viewer.types';
import { buildSampleDgBytes, parseDgBytes } from './dgn-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatDgFileSize,
  readFileBytes as readDgFileBytes
} from './cad-file.utils';

export {
  buildSampleDgBytes,
  buildSampleDgJson,
  filterDgCivil,
  filterDgEntities,
  filterDgLayers,
  filterDgRows,
  parseDgBytes,
  parseDgText
} from './dgn-viewer-parse.utils';
export { dgTypeColor, renderDgCivil, renderDgDrawing, renderDgLayers, toCadGeom } from './dgn-viewer-render.utils';

export function isSupportedDgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateDgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DG_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(DG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDgFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: DG_SUPPORTED_EXTENSIONS,
    maxBytes: DG_MAX_FILE_BYTES,
    formatsLabel: '.dgn, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed DGN files are not supported — decompress first'
  });
}

export function createSampleDgFile(): File {
  return new File([cadBytesToBlobPart(buildSampleDgBytes())], 'site-corridor.dgn', { type: 'image/vnd.dgn', lastModified: 0 });
}

export function createDgFileRecord(file: File, bytes: Uint8Array): DgLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDgBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length && !parsed.entities.length && !parsed.civil.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DGN dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDg(file: DgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDgMetadataRows(dataset: DgDataset): DgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Levels', value: String(dataset.layerCount) },
    { key: 'Entities', value: String(dataset.entityCount) },
    { key: 'Civil', value: String(dataset.civilCount) }
  ];
}

export function buildDgLayerMetadata(layer: DgLayer): DgMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: `${layer.color} · ${layer.colorHex}` },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Entities', value: String(layer.entityCount) }
  ];
}

export function buildDgCivilMetadata(item: DgCivil): DgMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Type', value: item.type },
    { key: 'Level', value: item.level },
    { key: 'Elevation', value: String(item.elevation) },
    { key: 'Length', value: String(item.length) },
    { key: 'Label', value: item.label || '—' }
  ];
}

export function buildDgEntityMetadata(entity: DgEntity): DgMetadataRow[] {
  return [
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Level', value: entity.level },
    { key: 'X', value: String(entity.x) },
    { key: 'Y', value: String(entity.y) },
    { key: 'Text', value: entity.text || '—' }
  ];
}

export function exportDgSummaryJson(file: DgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DGN dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      levels: parsed.layers.map((l) => ({ name: l.name, color: l.color, visible: l.visible, entityCount: l.entityCount })),
      entities: parsed.entities.map((e) => ({
        name: e.name,
        type: e.type,
        level: e.level,
        x: e.x,
        y: e.y,
        x2: e.x2,
        y2: e.y2,
        r: e.r,
        text: e.text
      })),
      civil: parsed.civil.map((c) => ({
        name: c.name,
        type: c.type,
        level: c.level,
        elevation: c.elevation,
        length: c.length,
        label: c.label,
        points: c.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportDgSchemaCsv(dataset: DgDataset): string {
  const lines = ['kind,name,type,level,x,y'];
  for (const layer of dataset.layers) {
    lines.push(['level', csv(layer.name), 'level', csv(layer.name), '', ''].join(','));
  }
  for (const entity of dataset.entities) {
    lines.push(['entity', csv(entity.name), csv(entity.type), csv(entity.level), String(entity.x), String(entity.y)].join(','));
  }
  for (const item of dataset.civil) {
    lines.push(['civil', csv(item.name), csv(item.type), csv(item.level), String(item.points[0]?.x ?? ''), String(item.points[0]?.y ?? '')].join(','));
  }
  return lines.join('\n');
}

export function exportDgRowsCsv(dataset: DgDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveDgSuggestion(state: { hasFiles: boolean; hasError: boolean }): DgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor DGN sample',
      reason: 'Load a tiny MicroStation dump with WALLS, CIVIL alignment, and a site contour.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DGN dump',
      reason: 'Drop a .dgn dump, JSON, or CSV — or load the sample shop floor civil design.',
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
