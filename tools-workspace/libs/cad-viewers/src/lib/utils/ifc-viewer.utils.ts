import { IC_MAX_FILE_BYTES, IC_SUPPORTED_EXTENSIONS } from '../constants/ifc-viewer.constants';
import type { IcDataset, IcDiscipline, IcElement, IcLoadedFile, IcMetadataRow, IcProperty, IcSuggestion } from '../types/ifc-viewer.types';
import { buildSampleIcBytes, parseIcBytes } from './ifc-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatIcFileSize,
  readFileBytes as readIcFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleIcBytes,
  buildSampleIcJson,
  filterIcDisciplines,
  filterIcElements,
  filterIcProperties,
  filterIcRows,
  parseIcBytes,
  parseIcText
} from './ifc-viewer-parse.utils';
export { icTypeColor, renderIcBuilding, renderIcDisciplines, toIcCad3d } from './ifc-viewer-render.utils';

export function isSupportedIcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (IC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateIcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > IC_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(IC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidIcFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: IC_SUPPORTED_EXTENSIONS,
    maxBytes: IC_MAX_FILE_BYTES,
    formatsLabel: '.ifc, .ifcxml, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed IFC files are not supported — decompress first'
  });
}

export function createSampleIcFile(): File {
  return new File([cadBytesToBlobPart(buildSampleIcBytes())], 'library-annex.ifc', { type: 'application/x-step', lastModified: 0 });
}

export function createIcFileRecord(file: File, bytes: Uint8Array): IcLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: IcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseIcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.elements.length && !parsed.properties.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse IFC dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportIc(file: IcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildIcMetadataRows(dataset: IcDataset): IcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'IFC', value: dataset.ifcVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Elements', value: String(dataset.elementCount) },
    { key: 'Properties', value: String(dataset.propCount) },
    { key: 'Disciplines', value: String(dataset.discCount) }
  ];
}

export function buildIcElementMetadata(element: IcElement): IcMetadataRow[] {
  return [
    { key: 'Name', value: element.name },
    { key: 'IFC type', value: element.ifcType },
    { key: 'Kind', value: element.kind },
    { key: 'Discipline', value: element.discipline },
    { key: 'Center', value: `${element.cx}, ${element.cy}, ${element.cz}` },
    {
      key: 'Size',
      value: element.kind === 'cylinder' ? `r ${element.r} · h ${element.h}` : `${element.sx} × ${element.sy} × ${element.sz}`
    },
    { key: 'Volume', value: String(element.volume) }
  ];
}

export function buildIcPropertyMetadata(prop: IcProperty): IcMetadataRow[] {
  return [
    { key: 'Name', value: prop.name },
    { key: 'Pset', value: prop.pset || '—' },
    { key: 'Element', value: prop.element || '—' },
    { key: 'Value', value: prop.value || '—' },
    { key: 'Unit', value: prop.unit || '—' }
  ];
}

export function buildIcDisciplineMetadata(disc: IcDiscipline): IcMetadataRow[] {
  return [
    { key: 'Name', value: disc.name },
    { key: 'Description', value: disc.description || '—' },
    { key: 'Elements', value: String(disc.elementCount) }
  ];
}

export function exportIcSummaryJson(file: IcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed IFC dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      ifcVer: parsed.ifcVer,
      units: parsed.units,
      elements: parsed.elements.map((e) => ({
        name: e.name,
        kind: e.kind,
        ifcType: e.ifcType,
        discipline: e.discipline,
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
      properties: parsed.properties.map((p) => ({
        name: p.name,
        pset: p.pset,
        element: p.element,
        value: p.value,
        unit: p.unit
      })),
      disciplines: parsed.disciplines.map((d) => ({ name: d.name, description: d.description, elementCount: d.elementCount })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportIcSchemaCsv(dataset: IcDataset): string {
  const lines = ['kind,name,type,element,discipline,value'];
  for (const e of dataset.elements) {
    lines.push(['element', csv(e.name), csv(e.ifcType), csv(e.name), csv(e.discipline), csv(e.kind)].join(','));
  }
  for (const p of dataset.properties) {
    lines.push(['property', csv(p.name), csv(p.pset), csv(p.element), '', csv(p.value)].join(','));
  }
  for (const d of dataset.disciplines) {
    lines.push(['discipline', csv(d.name), 'discipline', '', csv(d.name), csv(d.description)].join(','));
  }
  return lines.join('\n');
}

export function exportIcRowsCsv(dataset: IcDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveIcSuggestion(state: { hasFiles: boolean; hasError: boolean }): IcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor IFC sample',
      reason: 'Load a tiny dump with slab, column, ShopRanker property, and Architecture/Structure disciplines.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an IFC building model',
      reason: 'Drop an ASCII .ifc dump, JSON, or CSV — or load the sample shop floor.',
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
