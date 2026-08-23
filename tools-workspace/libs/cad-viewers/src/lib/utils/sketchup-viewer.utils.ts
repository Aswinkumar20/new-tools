import { SK_MAX_FILE_BYTES, SK_SUPPORTED_EXTENSIONS } from '../constants/sketchup-viewer.constants';
import type { SkComponent, SkDataset, SkLoadedFile, SkMetadataRow, SkGroup, SkSuggestion } from '../types/sketchup-viewer.types';
import { buildSampleSkBytes, parseSkBytes } from './sketchup-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatSkFileSize,
  readFileBytes as readSkFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleSkBytes,
  buildSampleSkJson,
  filterSkComponents,
  filterSkInstances,
  filterSkGroups,
  filterSkRows,
  parseSkBytes,
  parseSkText
} from './sketchup-viewer-parse.utils';
export { skTypeColor, renderSkComponents, renderSkInstances, renderSkGroups, toCad3dInstances, toCad3dGroups } from './sketchup-viewer-render.utils';

export function isSupportedSkFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SK_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateSkFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SK_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(SK_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSkFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: SK_SUPPORTED_EXTENSIONS,
    maxBytes: SK_MAX_FILE_BYTES,
    formatsLabel: '.skp, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed SketchUp files are not supported — decompress first'
  });
}

export function createSampleSkFile(): File {
  return new File([cadBytesToBlobPart(buildSampleSkBytes())], 'cabin-massing.skp', { type: 'application/octet-stream', lastModified: 0 });
}

export function createSkFileRecord(file: File, bytes: Uint8Array): SkLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SkDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSkBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.groups.length && !parsed.components.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SketchUp dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSk(file: SkLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSkMetadataRows(dataset: SkDataset): SkMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Groups', value: String(dataset.groupCount) },
    { key: 'Components', value: String(dataset.componentCount) },
    { key: 'Instances', value: String(dataset.instanceCount) }
  ];
}

export function buildSkGroupMetadata(part: SkGroup): SkMetadataRow[] {
  return [
    { key: 'Name', value: part.name },
    { key: 'Kind', value: part.kind },
    { key: 'Center', value: `${part.cx}, ${part.cy}, ${part.cz}` },
    { key: 'Size', value: part.kind === 'cylinder' ? `r ${part.r} · h ${part.h}` : `${part.sx} × ${part.sy} × ${part.sz}` },
    { key: 'Volume', value: String(part.volume) }
  ];
}

export function buildSkComponentMetadata(assembly: SkComponent): SkMetadataRow[] {
  return [
    { key: 'Name', value: assembly.name },
    { key: 'Description', value: assembly.description || '—' },
    { key: 'Instances', value: String(assembly.instanceCount) }
  ];
}

export function exportSkSummaryJson(file: SkLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SketchUp dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      groups: parsed.groups.map((p) => ({
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
      components: parsed.components.map((a) => ({ name: a.name, description: a.description, instanceCount: a.instanceCount })),
      instances: parsed.instances.map((inst) => ({
        name: inst.name,
        group: inst.group,
        component: inst.component,
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

export function exportSkSchemaCsv(dataset: SkDataset): string {
  const lines = ['kind,name,type,group,component,value'];
  for (const p of dataset.groups) lines.push(['group', csv(p.name), csv(p.kind), csv(p.name), '', String(p.volume)].join(','));
  for (const a of dataset.components) lines.push(['component', csv(a.name), 'component', '', csv(a.name), csv(a.description)].join(','));
  for (const inst of dataset.instances) lines.push(['instance', csv(inst.name), 'instance', csv(inst.group), csv(inst.component), ''].join(','));
  return lines.join('\n');
}

export function exportSkRowsCsv(dataset: SkDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveSkSuggestion(state: { hasFiles: boolean; hasError: boolean }): SkSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor SketchUp sample',
      reason: 'Load a tiny GROUP dump with slab, counter, column, and ShopRankerMount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SketchUp model',
      reason: 'Drop a .skp / .skp dump, JSON, or CSV — or load the sample shop floor assembly.',
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
