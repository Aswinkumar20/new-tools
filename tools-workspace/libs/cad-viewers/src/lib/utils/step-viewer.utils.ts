import { ST_MAX_FILE_BYTES, ST_SUPPORTED_EXTENSIONS } from '../constants/step-viewer.constants';
import type { StDataset, StLoadedFile, StMeasurement, StMetadataRow, StSolid, StSuggestion } from '../types/step-viewer.types';
import { buildSampleStBytes, parseStBytes } from './step-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatStFileSize,
  readFileBytes as readStFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleStBytes,
  buildSampleStJson,
  filterStMeasurements,
  filterStRows,
  filterStSolids,
  parseStBytes,
  parseStText
} from './step-viewer-parse.utils';
export { renderStMeasurements, renderStSolids, stTypeColor, toCad3dSolids } from './step-viewer-render.utils';

export function isSupportedStFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (ST_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateStFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ST_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(ST_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidStFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: ST_SUPPORTED_EXTENSIONS,
    maxBytes: ST_MAX_FILE_BYTES,
    formatsLabel: '.step, .stp, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed STEP files are not supported — decompress first'
  });
}

export function createSampleStFile(): File {
  return new File([cadBytesToBlobPart(buildSampleStBytes())], 'hinge-leaf.step', { type: 'model/step', lastModified: 0 });
}

export function createStFileRecord(file: File, bytes: Uint8Array): StLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: StDataset | null = null;
  let softFail = false;
  try {
    parsed = parseStBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.solids.length && !parsed.products.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse STEP dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSt(file: StLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildStMetadataRows(dataset: StDataset): StMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Schema', value: dataset.schema || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Products', value: String(dataset.productCount) },
    { key: 'Solids', value: String(dataset.solidCount) },
    { key: 'Measurements', value: String(dataset.measurementCount) }
  ];
}

export function buildStSolidMetadata(solid: StSolid): StMetadataRow[] {
  return [
    { key: 'Name', value: solid.name },
    { key: 'Kind', value: solid.kind },
    { key: 'Center', value: `${solid.cx}, ${solid.cy}, ${solid.cz}` },
    { key: 'Size', value: solid.kind === 'cylinder' ? `r ${solid.r} · h ${solid.h}` : `${solid.sx} × ${solid.sy} × ${solid.sz}` },
    { key: 'Volume', value: String(solid.volume) }
  ];
}

export function buildStMeasMetadata(meas: StMeasurement): StMetadataRow[] {
  return [
    { key: 'Name', value: meas.name },
    { key: 'Type', value: meas.type },
    { key: 'Value', value: String(meas.value) },
    { key: 'Unit', value: meas.unit },
    { key: 'Label', value: meas.label || '—' }
  ];
}

export function exportStSummaryJson(file: StLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed STEP dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      schema: parsed.schema,
      units: parsed.units,
      products: parsed.products.map((p) => ({ name: p.name, description: p.description })),
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

export function exportStSchemaCsv(dataset: StDataset): string {
  const lines = ['kind,name,type,solid,length,value'];
  for (const p of dataset.products) lines.push(['product', csv(p.name), 'product', '', '', csv(p.description)].join(','));
  for (const s of dataset.solids) lines.push(['solid', csv(s.name), csv(s.kind), csv(s.name), String(s.h || s.sz || ''), String(s.volume)].join(','));
  for (const m of dataset.measurements) lines.push(['measurement', csv(m.name), csv(m.type), '', '', String(m.value)].join(','));
  return lines.join('\n');
}

export function exportStRowsCsv(dataset: StDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveStSuggestion(state: { hasFiles: boolean; hasError: boolean }): StSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor STEP sample',
      reason: 'Load a tiny ISO 10303 dump with slab, counter, column, and shop-width.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a STEP model',
      reason: 'Drop a .step / .stp dump, JSON, or CSV — or load the sample shop floor solids.',
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
