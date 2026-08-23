import { RV_MAX_FILE_BYTES, RV_SUPPORTED_EXTENSIONS } from '../constants/revit-viewer.constants';
import type { RvDataset, RvFamily, RvInstance, RvLoadedFile, RvMetadataRow, RvSuggestion, RvType } from '../types/revit-viewer.types';
import { buildSampleRvBytes, parseRvBytes } from './revit-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatRvFileSize,
  readFileBytes as readRvFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleRvBytes,
  buildSampleRvJson,
  filterRvFamilies,
  filterRvInstances,
  filterRvRows,
  filterRvTypes,
  parseRvBytes,
  parseRvText
} from './revit-viewer-parse.utils';
export { renderRvFamilies, renderRvNavigate, rvTypeColor, toRvCad3d } from './revit-viewer-render.utils';

export function isSupportedRvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (RV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateRvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RV_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(RV_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidRvFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: RV_SUPPORTED_EXTENSIONS,
    maxBytes: RV_MAX_FILE_BYTES,
    formatsLabel: '.rvt, .rfa, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Revit files are not supported — decompress first'
  });
}

export function createSampleRvFile(): File {
  return new File([cadBytesToBlobPart(buildSampleRvBytes())], 'classroom-wing.rvt', { type: 'application/octet-stream', lastModified: 0 });
}

export function createRvFileRecord(file: File, bytes: Uint8Array): RvLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: RvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseRvBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.instances.length && !parsed.families.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Revit dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportRv(file: RvLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRvMetadataRows(dataset: RvDataset): RvMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Revit', value: dataset.revitVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Instances', value: String(dataset.instanceCount) },
    { key: 'Families', value: String(dataset.familyCount) },
    { key: 'Types', value: String(dataset.typeCount) }
  ];
}

export function buildRvInstanceMetadata(inst: RvInstance): RvMetadataRow[] {
  return [
    { key: 'Name', value: inst.name },
    { key: 'Family', value: inst.family || '—' },
    { key: 'Type', value: inst.type || '—' },
    { key: 'Category', value: inst.category },
    { key: 'Kind', value: inst.kind },
    { key: 'Center', value: `${inst.cx}, ${inst.cy}, ${inst.cz}` },
    { key: 'Size', value: inst.kind === 'cylinder' ? `r ${inst.r} · h ${inst.h}` : `${inst.sx} × ${inst.sy} × ${inst.sz}` },
    { key: 'Volume', value: String(inst.volume) }
  ];
}

export function buildRvFamilyMetadata(family: RvFamily): RvMetadataRow[] {
  return [
    { key: 'Name', value: family.name },
    { key: 'Category', value: family.category },
    { key: 'Description', value: family.description || '—' },
    { key: 'Instances', value: String(family.instanceCount) }
  ];
}

export function buildRvTypeMetadata(type: RvType): RvMetadataRow[] {
  return [
    { key: 'Name', value: type.name },
    { key: 'Family', value: type.family || '—' },
    { key: 'Category', value: type.category },
    { key: 'Description', value: type.description || '—' },
    { key: 'Instances', value: String(type.instanceCount) }
  ];
}

export function exportRvSummaryJson(file: RvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Revit dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      revitVer: parsed.revitVer,
      units: parsed.units,
      instances: parsed.instances.map((inst) => ({
        name: inst.name,
        family: inst.family,
        type: inst.type,
        category: inst.category,
        kind: inst.kind,
        cx: inst.cx,
        cy: inst.cy,
        cz: inst.cz,
        sx: inst.sx,
        sy: inst.sy,
        sz: inst.sz,
        r: inst.r,
        h: inst.h,
        volume: inst.volume
      })),
      families: parsed.families.map((f) => ({
        name: f.name,
        category: f.category,
        description: f.description,
        instanceCount: f.instanceCount
      })),
      types: parsed.types.map((t) => ({
        name: t.name,
        family: t.family,
        category: t.category,
        description: t.description,
        instanceCount: t.instanceCount
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportRvSchemaCsv(dataset: RvDataset): string {
  const lines = ['kind,name,type,family,category,value'];
  for (const inst of dataset.instances) {
    lines.push(['instance', csv(inst.name), csv(inst.kind), csv(inst.family), csv(inst.category), csv(inst.type)].join(','));
  }
  for (const f of dataset.families) {
    lines.push(['family', csv(f.name), 'family', csv(f.name), csv(f.category), csv(f.description)].join(','));
  }
  for (const t of dataset.types) {
    lines.push(['type', csv(t.name), 'type', csv(t.family), csv(t.category), csv(t.description)].join(','));
  }
  return lines.join('\n');
}

export function exportRvRowsCsv(dataset: RvDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveRvSuggestion(state: { hasFiles: boolean; hasError: boolean }): RvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Revit sample',
      reason: 'Load a tiny dump with slab, ShopRankerMount family, and a round column.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Revit model',
      reason: 'Drop an ASCII .rvt dump, JSON, or CSV — or load the sample shop floor.',
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
