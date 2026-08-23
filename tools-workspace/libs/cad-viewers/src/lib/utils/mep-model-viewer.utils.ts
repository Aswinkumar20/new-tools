import { ME_MAX_FILE_BYTES, ME_SUPPORTED_EXTENSIONS } from '../constants/mep-model-viewer.constants';
import type { MeDataset, MeDiscipline, MeElement, MeLoadedFile, MeMetadataRow, MeSuggestion, MeSystem } from '../types/mep-model-viewer.types';
import { buildSampleMeBytes, parseMeBytes } from './mep-model-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatMeFileSize,
  readFileBytes as readMeFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleMeBytes,
  buildSampleMeJson,
  filterMeDisciplines,
  filterMeElements,
  filterMeRows,
  filterMeSystems,
  parseMeBytes,
  parseMeText
} from './mep-model-viewer-parse.utils';
export { meTypeColor, renderMeDisciplines, renderMePreview, toMeCad3d } from './mep-model-viewer-render.utils';

export function isSupportedMeFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (ME_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateMeFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ME_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(ME_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMeFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: ME_SUPPORTED_EXTENSIONS,
    maxBytes: ME_MAX_FILE_BYTES,
    formatsLabel: '.ifc, .ifcxml, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed MEP files are not supported — decompress first'
  });
}

export function createSampleMeFile(): File {
  return new File([cadBytesToBlobPart(buildSampleMeBytes())], 'hospital-hvac.ifc', { type: 'application/x-step', lastModified: 0 });
}

export function createMeFileRecord(file: File, bytes: Uint8Array): MeLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MeDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMeBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.elements.length && !parsed.systems.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse MEP dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMe(file: MeLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMeMetadataRows(dataset: MeDataset): MeMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'MEP', value: dataset.mepVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Elements', value: String(dataset.elementCount) },
    { key: 'Systems', value: String(dataset.systemCount) },
    { key: 'Disciplines', value: String(dataset.discCount) }
  ];
}

export function buildMeElementMetadata(element: MeElement): MeMetadataRow[] {
  return [
    { key: 'Name', value: element.name },
    { key: 'Kind', value: element.kind },
    { key: 'Discipline', value: String(element.discipline) },
    { key: 'System', value: element.system },
    { key: 'Center', value: `${element.cx}, ${element.cy}, ${element.cz}` },
    {
      key: 'Size',
      value: element.kind === 'cylinder' ? `r ${element.r} · h ${element.h}` : `${element.sx} × ${element.sy} × ${element.sz}`
    },
    { key: 'Volume', value: String(element.volume) }
  ];
}

export function buildMeSystemMetadata(system: MeSystem): MeMetadataRow[] {
  return [
    { key: 'Name', value: system.name },
    { key: 'Discipline', value: system.discipline || '—' },
    { key: 'Description', value: system.description || '—' },
    { key: 'Elements', value: String(system.elementCount) }
  ];
}

export function buildMeDisciplineMetadata(disc: MeDiscipline): MeMetadataRow[] {
  return [
    { key: 'Name', value: disc.name },
    { key: 'Description', value: disc.description || '—' },
    { key: 'Elements', value: String(disc.elementCount) }
  ];
}

export function exportMeSummaryJson(file: MeLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed MEP dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      mepVer: parsed.mepVer,
      units: parsed.units,
      elements: parsed.elements.map((e) => ({
        name: e.name,
        kind: e.kind,
        discipline: e.discipline,
        system: e.system,
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
      systems: parsed.systems.map((s) => ({
        name: s.name,
        discipline: s.discipline,
        description: s.description,
        elementCount: s.elementCount
      })),
      disciplines: parsed.disciplines.map((d) => ({ name: d.name, description: d.description, elementCount: d.elementCount })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportMeSchemaCsv(dataset: MeDataset): string {
  const lines = ['kind,name,type,discipline,system,value'];
  for (const e of dataset.elements) {
    lines.push(['element', csv(e.name), csv(e.kind), csv(String(e.discipline)), csv(e.system), csv(e.kind)].join(','));
  }
  for (const s of dataset.systems) {
    lines.push(['system', csv(s.name), 'system', csv(s.discipline), csv(s.name), csv(s.description)].join(','));
  }
  for (const d of dataset.disciplines) {
    lines.push(['discipline', csv(d.name), 'discipline', csv(d.name), '', csv(d.description)].join(','));
  }
  return lines.join('\n');
}

export function exportMeRowsCsv(dataset: MeDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveMeSuggestion(state: { hasFiles: boolean; hasError: boolean }): MeSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor MEP sample',
      reason: 'Load a tiny dump with Mechanical/Electrical/Plumbing, SupplyAir/Lighting, duct, pipe, tray, and ShopRanker lighting.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an MEP model',
      reason: 'Drop an ASCII .ifc MEP dump, JSON, or CSV — or load the sample shop floor.',
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
