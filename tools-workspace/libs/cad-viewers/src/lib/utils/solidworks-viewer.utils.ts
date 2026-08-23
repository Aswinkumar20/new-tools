import { SW_MAX_FILE_BYTES, SW_SUPPORTED_EXTENSIONS } from '../constants/solidworks-viewer.constants';
import type { SwAssembly, SwDataset, SwLoadedFile, SwMetadataRow, SwPart, SwSuggestion } from '../types/solidworks-viewer.types';
import { buildSampleSwBytes, parseSwBytes } from './solidworks-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatSwFileSize,
  readFileBytes as readSwFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleSwBytes,
  buildSampleSwJson,
  filterSwAssemblies,
  filterSwInstances,
  filterSwParts,
  filterSwRows,
  parseSwBytes,
  parseSwText
} from './solidworks-viewer-parse.utils';
export { swTypeColor, renderSwAssemblies, renderSwInstances, renderSwParts, toCad3dInstances, toCad3dParts } from './solidworks-viewer-render.utils';

export function isSupportedSwFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SW_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateSwFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SW_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(SW_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSwFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: SW_SUPPORTED_EXTENSIONS,
    maxBytes: SW_MAX_FILE_BYTES,
    formatsLabel: '.sldprt, .sldasm, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed SolidWorks files are not supported — decompress first'
  });
}

export function createSampleSwFile(): File {
  return new File([cadBytesToBlobPart(buildSampleSwBytes())], 'valve-body.sldprt', { type: 'application/octet-stream', lastModified: 0 });
}

export function createSwFileRecord(file: File, bytes: Uint8Array): SwLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SwDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSwBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.parts.length && !parsed.assemblies.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SolidWorks dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSw(file: SwLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSwMetadataRows(dataset: SwDataset): SwMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Parts', value: String(dataset.partCount) },
    { key: 'Assemblies', value: String(dataset.assemblyCount) },
    { key: 'Instances', value: String(dataset.instanceCount) }
  ];
}

export function buildSwPartMetadata(part: SwPart): SwMetadataRow[] {
  return [
    { key: 'Name', value: part.name },
    { key: 'Kind', value: part.kind },
    { key: 'Center', value: `${part.cx}, ${part.cy}, ${part.cz}` },
    { key: 'Size', value: part.kind === 'cylinder' ? `r ${part.r} · h ${part.h}` : `${part.sx} × ${part.sy} × ${part.sz}` },
    { key: 'Volume', value: String(part.volume) }
  ];
}

export function buildSwAssemblyMetadata(assembly: SwAssembly): SwMetadataRow[] {
  return [
    { key: 'Name', value: assembly.name },
    { key: 'Description', value: assembly.description || '—' },
    { key: 'Instances', value: String(assembly.instanceCount) }
  ];
}

export function exportSwSummaryJson(file: SwLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SolidWorks dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      units: parsed.units,
      parts: parsed.parts.map((p) => ({
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
      assemblies: parsed.assemblies.map((a) => ({ name: a.name, description: a.description, instanceCount: a.instanceCount })),
      instances: parsed.instances.map((inst) => ({
        name: inst.name,
        part: inst.part,
        assembly: inst.assembly,
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

export function exportSwSchemaCsv(dataset: SwDataset): string {
  const lines = ['kind,name,type,part,assembly,value'];
  for (const p of dataset.parts) lines.push(['part', csv(p.name), csv(p.kind), csv(p.name), '', String(p.volume)].join(','));
  for (const a of dataset.assemblies) lines.push(['assembly', csv(a.name), 'assembly', '', csv(a.name), csv(a.description)].join(','));
  for (const inst of dataset.instances) lines.push(['instance', csv(inst.name), 'instance', csv(inst.part), csv(inst.assembly), ''].join(','));
  return lines.join('\n');
}

export function exportSwRowsCsv(dataset: SwDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveSwSuggestion(state: { hasFiles: boolean; hasError: boolean }): SwSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor SolidWorks sample',
      reason: 'Load a tiny SLDPRT dump with slab, counter, column, and ShopRankerMount.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SolidWorks model',
      reason: 'Drop a .sldprt / .sldasm dump, JSON, or CSV — or load the sample shop floor assembly.',
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
