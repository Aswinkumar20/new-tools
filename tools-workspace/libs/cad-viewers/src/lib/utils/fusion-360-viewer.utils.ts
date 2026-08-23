import { FU_MAX_FILE_BYTES, FU_SUPPORTED_EXTENSIONS } from '../constants/fusion-360-viewer.constants';
import type { FuComponent, FuDataset, FuLoadedFile, FuMetadataRow, FuBody, FuSuggestion } from '../types/fusion-360-viewer.types';
import { buildSampleFuBytes, parseFuBytes } from './fusion-360-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatFuFileSize,
  readFileBytes as readFuFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleFuBytes,
  buildSampleFuJson,
  filterFuComponents,
  filterFuInstances,
  filterFuBodies,
  filterFuRows,
  parseFuBytes,
  parseFuText
} from './fusion-360-viewer-parse.utils';
export { fuTypeColor, renderFuComponents, renderFuInstances, renderFuBodies, toCad3dInstances, toCad3dBodies } from './fusion-360-viewer-render.utils';

export function isSupportedFuFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FU_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateFuFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FU_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(FU_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFuFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: FU_SUPPORTED_EXTENSIONS,
    maxBytes: FU_MAX_FILE_BYTES,
    formatsLabel: '.f3d, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed Fusion files are not supported — decompress first'
  });
}

export function createSampleFuFile(): File {
  return new File([cadBytesToBlobPart(buildSampleFuBytes())], 'enclosure-lid.f3d', { type: 'application/octet-stream', lastModified: 0 });
}

export function createFuFileRecord(file: File, bytes: Uint8Array): FuLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FuDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFuBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.bodies.length && !parsed.components.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Fusion dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFu(file: FuLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFuMetadataRows(dataset: FuDataset): FuMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Bodies', value: String(dataset.bodyCount) },
    { key: 'Components', value: String(dataset.componentCount) },
    { key: 'Instances', value: String(dataset.instanceCount) }
  ];
}

export function buildFuBodyMetadata(part: FuBody): FuMetadataRow[] {
  return [
    { key: 'Name', value: part.name },
    { key: 'Kind', value: part.kind },
    { key: 'Center', value: `${part.cx}, ${part.cy}, ${part.cz}` },
    { key: 'Size', value: part.kind === 'cylinder' ? `r ${part.r} · h ${part.h}` : `${part.sx} × ${part.sy} × ${part.sz}` },
    { key: 'Volume', value: String(part.volume) }
  ];
}

export function buildFuComponentMetadata(assembly: FuComponent): FuMetadataRow[] {
  return [
    { key: 'Name', value: assembly.name },
    { key: 'Description', value: assembly.description || '—' },
    { key: 'Instances', value: String(assembly.instanceCount) }
  ];
}

export function exportFuSummaryJson(file: FuLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Fusion dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      bodies: parsed.bodies.map((p) => ({
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
        body: inst.body,
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

export function exportFuSchemaCsv(dataset: FuDataset): string {
  const lines = ['kind,name,type,body,component,value'];
  for (const p of dataset.bodies) lines.push(['body', csv(p.name), csv(p.kind), csv(p.name), '', String(p.volume)].join(','));
  for (const a of dataset.components) lines.push(['component', csv(a.name), 'component', '', csv(a.name), csv(a.description)].join(','));
  for (const inst of dataset.instances) lines.push(['instance', csv(inst.name), 'instance', csv(inst.body), csv(inst.component), ''].join(','));
  return lines.join('\n');
}

export function exportFuRowsCsv(dataset: FuDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveFuSuggestion(state: { hasFiles: boolean; hasError: boolean }): FuSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Fusion sample',
      reason: 'Load a tiny BODY dump with slab, counter, column, and ShopRankerMount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Fusion 360 design',
      reason: 'Drop a .f3d / .f3d dump, JSON, or CSV — or load the sample shop floor assembly.',
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
