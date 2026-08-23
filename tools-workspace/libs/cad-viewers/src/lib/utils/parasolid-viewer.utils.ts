import { PX_MAX_FILE_BYTES, PX_SUPPORTED_EXTENSIONS } from '../constants/parasolid-viewer.constants';
import type { PxDataset, PxLoadedFile, PxMeasurement, PxMetadataRow, PxSolid, PxSuggestion } from '../types/parasolid-viewer.types';
import { buildSamplePxBytes, parsePxBytes, pxTransmitKind } from './parasolid-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatPxFileSize,
  readFileBytes as readPxFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSamplePxBytes,
  buildSamplePxJson,
  filterPxMeasurements,
  filterPxRows,
  filterPxSolids,
  parsePxBytes,
  parsePxText,
  pxTransmitKind
} from './parasolid-viewer-parse.utils';
export { pxTypeColor, renderPxMeasurements, renderPxSolids, toCad3dSolids } from './parasolid-viewer-render.utils';

function pxExtension(fileName: string): string {
  const transmit = pxTransmitKind(fileName);
  if (transmit === 'x_t') return '.x_t';
  if (transmit === 'x_b') return '.x_b';
  return getCadFileExtension(fileName);
}

export function isSupportedPxFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PX_SUPPORTED_EXTENSIONS as readonly string[]).includes(pxExtension(file.name));
}

export function validatePxFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PX_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(PX_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPxFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: PX_SUPPORTED_EXTENSIONS,
    maxBytes: PX_MAX_FILE_BYTES,
    formatsLabel: '.x_t, .x_b, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Parasolid files are not supported — decompress first'
  });
}

export function createSamplePxFile(): File {
  return new File([cadBytesToBlobPart(buildSamplePxBytes())], 'gearbox-housing.x_t', { type: 'application/octet-stream', lastModified: 0 });
}

export function createPxFileRecord(file: File, bytes: Uint8Array): PxLoadedFile {
  const extension = pxExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PxDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePxBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.solids.length && !parsed.bodies.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Parasolid dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPx(file: PxLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPxMetadataRows(dataset: PxDataset): PxMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Schema', value: dataset.schema || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Bodies', value: String(dataset.bodyCount) },
    { key: 'Solids', value: String(dataset.solidCount) },
    { key: 'Measurements', value: String(dataset.measurementCount) }
  ];
}

export function buildPxSolidMetadata(solid: PxSolid): PxMetadataRow[] {
  return [
    { key: 'Name', value: solid.name },
    { key: 'Kind', value: solid.kind },
    { key: 'Center', value: `${solid.cx}, ${solid.cy}, ${solid.cz}` },
    { key: 'Size', value: solid.kind === 'cylinder' ? `r ${solid.r} · h ${solid.h}` : `${solid.sx} × ${solid.sy} × ${solid.sz}` },
    { key: 'Volume', value: String(solid.volume) }
  ];
}

export function buildPxMeasMetadata(meas: PxMeasurement): PxMetadataRow[] {
  return [
    { key: 'Name', value: meas.name },
    { key: 'Type', value: meas.type },
    { key: 'Value', value: String(meas.value) },
    { key: 'Unit', value: meas.unit },
    { key: 'Label', value: meas.label || '—' }
  ];
}

export function exportPxSummaryJson(file: PxLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Parasolid dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      schema: parsed.schema,
      units: parsed.units,
      bodies: parsed.bodies.map((b) => ({ name: b.name, description: b.description })),
      solids: parsed.solids.map((s) => ({
        name: s.name,
        kind: s.kind,
        cx: s.cx,
        cy: s.cy,
        cz: s.cz,
        sx: s.sx,
        sy: s.sy,
        sz: s.sz,
        r: s.r,
        h: s.h,
        volume: s.volume
      })),
      measurements: parsed.measurements.map((m) => ({ name: m.name, type: m.type, value: m.value, unit: m.unit, label: m.label })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPxSchemaCsv(dataset: PxDataset): string {
  const lines = ['kind,name,type,solid,length,value'];
  for (const b of dataset.bodies) lines.push(['body', csv(b.name), 'body', '', '', csv(b.description)].join(','));
  for (const s of dataset.solids) lines.push(['solid', csv(s.name), csv(s.kind), csv(s.name), String(s.h || s.sz || ''), String(s.volume)].join(','));
  for (const m of dataset.measurements) lines.push(['measurement', csv(m.name), csv(m.type), '', '', String(m.value)].join(','));
  return lines.join('\n');
}

export function exportPxRowsCsv(dataset: PxDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolvePxSuggestion(state: { hasFiles: boolean; hasError: boolean }): PxSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Parasolid sample',
      reason: 'Load a tiny XT dump with slab, counter, column, and shop-width.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Parasolid model',
      reason: 'Drop a .x_t / .x_b dump, JSON, or CSV — or load the sample shop floor solids.',
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
