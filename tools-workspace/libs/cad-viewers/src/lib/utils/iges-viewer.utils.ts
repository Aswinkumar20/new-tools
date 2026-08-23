import { IG_MAX_FILE_BYTES, IG_SUPPORTED_EXTENSIONS } from '../constants/iges-viewer.constants';
import type { IgDataset, IgEntity, IgLoadedFile, IgMetadataRow, IgSuggestion, IgSurface } from '../types/iges-viewer.types';
import { buildSampleIgBytes, parseIgBytes } from './iges-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatIgFileSize,
  readFileBytes as readIgFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleIgBytes,
  buildSampleIgJson,
  filterIgEntities,
  filterIgRows,
  filterIgSurfaces,
  parseIgBytes,
  parseIgText
} from './iges-viewer-parse.utils';
export { igTypeColor, renderIgEntities, renderIgSurfaces, toCad3dSurfaces } from './iges-viewer-render.utils';

export function isSupportedIgFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (IG_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateIgFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > IG_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(IG_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidIgFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: IG_SUPPORTED_EXTENSIONS,
    maxBytes: IG_MAX_FILE_BYTES,
    formatsLabel: '.iges, .igs, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed IGES files are not supported — decompress first'
  });
}

export function createSampleIgFile(): File {
  return new File([cadBytesToBlobPart(buildSampleIgBytes())], 'impeller-hub.iges', { type: 'model/iges', lastModified: 0 });
}

export function createIgFileRecord(file: File, bytes: Uint8Array): IgLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: IgDataset | null = null;
  let softFail = false;
  try {
    parsed = parseIgBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.surfaces.length && !parsed.entities.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse IGES dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportIg(file: IgLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildIgMetadataRows(dataset: IgDataset): IgMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Surfaces', value: String(dataset.surfaceCount) },
    { key: 'Entities', value: String(dataset.entityCount) }
  ];
}

export function buildIgSurfaceMetadata(surface: IgSurface): IgMetadataRow[] {
  return [
    { key: 'Name', value: surface.name },
    { key: 'Kind', value: surface.kind },
    { key: 'Center', value: `${surface.cx}, ${surface.cy}, ${surface.cz}` },
    { key: 'Size', value: surface.kind === 'cylinder' ? `r ${surface.r} · h ${surface.h}` : `${surface.sx} × ${surface.sy}` }
  ];
}

export function buildIgEntityMetadata(entity: IgEntity): IgMetadataRow[] {
  return [
    { key: 'Name', value: entity.name },
    { key: 'Type', value: entity.type },
    { key: 'Code', value: String(entity.typeCode || '—') },
    { key: 'Surface', value: entity.surface || '—' },
    { key: 'XYZ', value: `${entity.x}, ${entity.y}, ${entity.z}` },
    { key: 'Text', value: entity.text || '—' }
  ];
}

export function exportIgSummaryJson(file: IgLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed IGES dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      surfaces: parsed.surfaces.map((s) => ({
        name: s.name,
        kind: s.kind,
        cx: s.cx,
        cy: s.cy,
        cz: s.cz,
        sx: s.sx,
        sy: s.sy,
        sz: s.sz,
        r: s.r,
        h: s.h
      })),
      entities: parsed.entities.map((e) => ({
        name: e.name,
        type: e.type,
        typeCode: e.typeCode,
        surface: e.surface,
        x: e.x,
        y: e.y,
        z: e.z,
        text: e.text
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportIgSchemaCsv(dataset: IgDataset): string {
  const lines = ['kind,name,type,surface,x,y'];
  for (const s of dataset.surfaces) lines.push(['surface', csv(s.name), csv(s.kind), csv(s.name), String(s.cx), String(s.cy)].join(','));
  for (const e of dataset.entities) lines.push(['entity', csv(e.name), csv(e.type), csv(e.surface), String(e.x), String(e.y)].join(','));
  return lines.join('\n');
}

export function exportIgRowsCsv(dataset: IgDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveIgSuggestion(state: { hasFiles: boolean; hasError: boolean }): IgSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor IGES sample',
      reason: 'Load a tiny IGES dump with slab, wall, counter-top, and a column cylinder.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an IGES model',
      reason: 'Drop a .iges / .igs dump, JSON, or CSV — or load the sample shop floor surfaces.',
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
