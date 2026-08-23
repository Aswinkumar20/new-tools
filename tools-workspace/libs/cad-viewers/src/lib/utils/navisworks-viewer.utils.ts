import { NW_MAX_FILE_BYTES, NW_SUPPORTED_EXTENSIONS } from '../constants/navisworks-viewer.constants';
import type { NwClash, NwDataset, NwItem, NwLoadedFile, NwMetadataRow, NwModel, NwSuggestion } from '../types/navisworks-viewer.types';
import { buildSampleNwBytes, parseNwBytes } from './navisworks-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatNwFileSize,
  readFileBytes as readNwFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleNwBytes,
  buildSampleNwJson,
  filterNwClashes,
  filterNwItems,
  filterNwModels,
  filterNwRows,
  parseNwBytes,
  parseNwText
} from './navisworks-viewer-parse.utils';
export { nwTypeColor, renderNwModels, renderNwNavigate, toNwCad3d } from './navisworks-viewer-render.utils';

export function isSupportedNwFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (NW_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateNwFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NW_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(NW_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidNwFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: NW_SUPPORTED_EXTENSIONS,
    maxBytes: NW_MAX_FILE_BYTES,
    formatsLabel: '.nwd, .nwf, .nwc, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Navisworks files are not supported — decompress first'
  });
}

export function createSampleNwFile(): File {
  return new File([cadBytesToBlobPart(buildSampleNwBytes())], 'campus-fed.nwd', { type: 'application/octet-stream', lastModified: 0 });
}

export function createNwFileRecord(file: File, bytes: Uint8Array): NwLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: NwDataset | null = null;
  let softFail = false;
  try {
    parsed = parseNwBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.items.length && !parsed.clashes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Navisworks dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportNw(file: NwLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildNwMetadataRows(dataset: NwDataset): NwMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Navisworks', value: dataset.navisVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Items', value: String(dataset.itemCount) },
    { key: 'Clashes', value: String(dataset.clashCount) },
    { key: 'Models', value: String(dataset.modelCount) }
  ];
}

export function buildNwItemMetadata(item: NwItem): NwMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Kind', value: item.kind },
    { key: 'Model', value: item.model },
    { key: 'Center', value: `${item.cx}, ${item.cy}, ${item.cz}` },
    {
      key: 'Size',
      value: item.kind === 'cylinder' ? `r ${item.r} · h ${item.h}` : `${item.sx} × ${item.sy} × ${item.sz}`
    },
    { key: 'Volume', value: String(item.volume) }
  ];
}

export function buildNwClashMetadata(clash: NwClash): NwMetadataRow[] {
  return [
    { key: 'Name', value: clash.name },
    { key: 'Type', value: clash.clashType },
    { key: 'Status', value: clash.status },
    { key: 'Item A', value: clash.itemA || '—' },
    { key: 'Item B', value: clash.itemB || '—' },
    { key: 'Distance', value: String(clash.distance) },
    { key: 'Focus', value: `${clash.cx}, ${clash.cy}, ${clash.cz}` }
  ];
}

export function buildNwModelMetadata(model: NwModel): NwMetadataRow[] {
  return [
    { key: 'Name', value: model.name },
    { key: 'Description', value: model.description || '—' },
    { key: 'Items', value: String(model.itemCount) }
  ];
}

export function exportNwSummaryJson(file: NwLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Navisworks dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      navisVer: parsed.navisVer,
      units: parsed.units,
      items: parsed.items.map((e) => ({
        name: e.name,
        kind: e.kind,
        model: e.model,
        cx: e.cx,
        cy: e.cy,
        cz: e.cz,
        sx: e.sx,
        sy: e.sy,
        sz: e.sz,
        r: e.r,
        h: e.h,
        volume: e.volume
      })),
      clashes: parsed.clashes.map((c) => ({
        name: c.name,
        clashType: c.clashType,
        status: c.status,
        itemA: c.itemA,
        itemB: c.itemB,
        distance: c.distance,
        cx: c.cx,
        cy: c.cy,
        cz: c.cz
      })),
      models: parsed.models.map((d) => ({ name: d.name, description: d.description, itemCount: d.itemCount })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportNwSchemaCsv(dataset: NwDataset): string {
  const lines = ['kind,name,type,model,clash,value'];
  for (const e of dataset.items) {
    lines.push(['item', csv(e.name), csv(e.kind), csv(e.model), '', csv(e.kind)].join(','));
  }
  for (const c of dataset.clashes) {
    lines.push(['clash', csv(c.name), csv(c.clashType), '', csv(c.name), csv(`${c.itemA}|${c.itemB}`)].join(','));
  }
  for (const d of dataset.models) {
    lines.push(['model', csv(d.name), 'model', csv(d.name), '', csv(d.description)].join(','));
  }
  return lines.join('\n');
}

export function exportNwRowsCsv(dataset: NwDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveNwSuggestion(state: { hasFiles: boolean; hasError: boolean }): NwSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Navisworks sample',
      reason: 'Load a tiny dump with Architecture/Structure/MEP, column vs duct hard clash, and ShopRanker clearance.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Navisworks coordination model',
      reason: 'Drop an ASCII .nwd dump, JSON, or CSV — or load the sample shop floor.',
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
