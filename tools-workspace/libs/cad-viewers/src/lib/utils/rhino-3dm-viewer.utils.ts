import { RH_MAX_FILE_BYTES, RH_SUPPORTED_EXTENSIONS } from '../constants/rhino-3dm-viewer.constants';
import type { RhLayer, RhDataset, RhLoadedFile, RhMetadataRow, RhSurface, RhSuggestion } from '../types/rhino-3dm-viewer.types';
import { buildSampleRhBytes, parseRhBytes } from './rhino-3dm-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatRhFileSize,
  readFileBytes as readRhFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleRhBytes,
  buildSampleRhJson,
  filterRhLayers,
  filterRhInstances,
  filterRhSurfaces,
  filterRhRows,
  parseRhBytes,
  parseRhText
} from './rhino-3dm-viewer-parse.utils';
export { rhTypeColor, renderRhLayers, renderRhInstances, renderRhSurfaces, toCad3dInstances, toCad3dSurfaces } from './rhino-3dm-viewer-render.utils';

export function isSupportedRhFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (RH_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateRhFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RH_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(RH_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidRhFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: RH_SUPPORTED_EXTENSIONS,
    maxBytes: RH_MAX_FILE_BYTES,
    formatsLabel: '.3dm, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Rhino files are not supported — decompress first'
  });
}

export function createSampleRhFile(): File {
  return new File([cadBytesToBlobPart(buildSampleRhBytes())], 'faucet-body.3dm', { type: 'application/octet-stream', lastModified: 0 });
}

export function createRhFileRecord(file: File, bytes: Uint8Array): RhLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: RhDataset | null = null;
  let softFail = false;
  try {
    parsed = parseRhBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.surfaces.length && !parsed.layers.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Rhino dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportRh(file: RhLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRhMetadataRows(dataset: RhDataset): RhMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Surfaces', value: String(dataset.surfaceCount) },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Instances', value: String(dataset.instanceCount) }
  ];
}

export function buildRhSurfaceMetadata(part: RhSurface): RhMetadataRow[] {
  return [
    { key: 'Name', value: part.name },
    { key: 'Kind', value: part.kind },
    { key: 'Center', value: `${part.cx}, ${part.cy}, ${part.cz}` },
    { key: 'Size', value: part.kind === 'cylinder' ? `r ${part.r} · h ${part.h}` : `${part.sx} × ${part.sy} × ${part.sz}` },
    { key: 'Volume', value: String(part.volume) }
  ];
}

export function buildRhLayerMetadata(assembly: RhLayer): RhMetadataRow[] {
  return [
    { key: 'Name', value: assembly.name },
    { key: 'Description', value: assembly.description || '—' },
    { key: 'Instances', value: String(assembly.instanceCount) }
  ];
}

export function exportRhSummaryJson(file: RhLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Rhino dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      surfaces: parsed.surfaces.map((p) => ({
        name: p.name,
        kind: p.kind,
        cx: p.cx,
        cy: p.cy,
        cz: p.cz,
        sx: p.sx,
        sy: p.sy,
        sz: p.sz,
        r: p.r,
        h: p.h,
        volume: p.volume
      })),
      layers: parsed.layers.map((a) => ({ name: a.name, description: a.description, instanceCount: a.instanceCount })),
      instances: parsed.instances.map((inst) => ({
        name: inst.name,
        surface: inst.surface,
        layer: inst.layer,
        cx: inst.cx,
        cy: inst.cy,
        cz: inst.cz
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportRhSchemaCsv(dataset: RhDataset): string {
  const lines = ['kind,name,type,surface,layer,value'];
  for (const p of dataset.surfaces) lines.push(['surface', csv(p.name), csv(p.kind), csv(p.name), '', String(p.volume)].join(','));
  for (const a of dataset.layers) lines.push(['layer', csv(a.name), 'layer', '', csv(a.name), csv(a.description)].join(','));
  for (const inst of dataset.instances) lines.push(['instance', csv(inst.name), 'instance', csv(inst.surface), csv(inst.layer), ''].join(','));
  return lines.join('\n');
}

export function exportRhRowsCsv(dataset: RhDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveRhSuggestion(state: { hasFiles: boolean; hasError: boolean }): RhSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Rhino sample',
      reason: 'Load a tiny SURFACE dump with slab, counter, column, and ShopRankerMount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Rhino model',
      reason: 'Drop a .3dm / .3dm dump, JSON, or CSV — or load the sample shop floor assembly.',
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
