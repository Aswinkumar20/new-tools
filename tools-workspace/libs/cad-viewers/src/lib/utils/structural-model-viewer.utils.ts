import { SR_MAX_FILE_BYTES, SR_SUPPORTED_EXTENSIONS } from '../constants/structural-model-viewer.constants';
import type {
  SrDataset,
  SrLoadedFile,
  SrMember,
  SrMetadataRow,
  SrProperty,
  SrSection,
  SrSuggestion
} from '../types/structural-model-viewer.types';
import { buildSampleSrBytes, parseSrBytes } from './structural-model-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatSrFileSize,
  readFileBytes as readSrFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleSrBytes,
  buildSampleSrJson,
  filterSrMembers,
  filterSrProperties,
  filterSrRows,
  filterSrSections,
  parseSrBytes,
  parseSrText
} from './structural-model-viewer-parse.utils';
export { renderSrPreview, renderSrSections, srTypeColor, toSrCad3d } from './structural-model-viewer-render.utils';

export function isSupportedSrFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SR_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateSrFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SR_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(SR_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSrFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: SR_SUPPORTED_EXTENSIONS,
    maxBytes: SR_MAX_FILE_BYTES,
    formatsLabel: '.ifc, .ifcxml, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed structural files are not supported — decompress first'
  });
}

export function createSampleSrFile(): File {
  return new File([cadBytesToBlobPart(buildSampleSrBytes())], 'parking-frame.ifc', { type: 'application/x-step', lastModified: 0 });
}

export function createSrFileRecord(file: File, bytes: Uint8Array): SrLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SrDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSrBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.members.length && !parsed.properties.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Structural dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSr(file: SrLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSrMetadataRows(dataset: SrDataset): SrMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Structural', value: dataset.structVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Members', value: String(dataset.memberCount) },
    { key: 'Properties', value: String(dataset.propCount) },
    { key: 'Sections', value: String(dataset.sectionCount) }
  ];
}

export function buildSrMemberMetadata(member: SrMember): SrMetadataRow[] {
  return [
    { key: 'Name', value: member.name },
    { key: 'Kind', value: member.kind },
    { key: 'Type', value: member.memberType },
    { key: 'Section', value: member.section },
    { key: 'Center', value: `${member.cx}, ${member.cy}, ${member.cz}` },
    {
      key: 'Size',
      value: member.kind === 'cylinder' ? `r ${member.r} · h ${member.h}` : `${member.sx} × ${member.sy} × ${member.sz}`
    },
    { key: 'Volume', value: String(member.volume) }
  ];
}

export function buildSrPropertyMetadata(prop: SrProperty): SrMetadataRow[] {
  return [
    { key: 'Name', value: prop.name },
    { key: 'Pset', value: prop.pset || '—' },
    { key: 'Member', value: prop.member || '—' },
    { key: 'Value', value: prop.value || '—' },
    { key: 'Unit', value: prop.unit || '—' }
  ];
}

export function buildSrSectionMetadata(section: SrSection): SrMetadataRow[] {
  return [
    { key: 'Name', value: section.name },
    { key: 'Description', value: section.description || '—' },
    { key: 'Members', value: String(section.memberCount) }
  ];
}

export function exportSrSummaryJson(file: SrLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Structural dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      structVer: parsed.structVer,
      units: parsed.units,
      members: parsed.members.map((m) => ({
        name: m.name,
        kind: m.kind,
        memberType: m.memberType,
        section: m.section,
        cx: m.cx,
        cy: m.cy,
        cz: m.cz,
        sx: m.sx,
        sy: m.sy,
        sz: m.sz,
        r: m.r,
        h: m.h,
        volume: m.volume
      })),
      properties: parsed.properties.map((p) => ({
        name: p.name,
        pset: p.pset,
        member: p.member,
        value: p.value,
        unit: p.unit
      })),
      sections: parsed.sections.map((s) => ({ name: s.name, description: s.description, memberCount: s.memberCount })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportSrSchemaCsv(dataset: SrDataset): string {
  const lines = ['kind,name,type,section,member,value'];
  for (const m of dataset.members) {
    lines.push(['member', csv(m.name), csv(m.memberType), csv(m.section), csv(m.name), csv(m.kind)].join(','));
  }
  for (const p of dataset.properties) {
    lines.push(['property', csv(p.name), csv(p.pset), csv(p.pset), csv(p.member), csv(p.value)].join(','));
  }
  for (const s of dataset.sections) {
    lines.push(['section', csv(s.name), 'section', csv(s.name), '', csv(s.description)].join(','));
  }
  return lines.join('\n');
}

export function exportSrRowsCsv(dataset: SrDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveSrSuggestion(state: { hasFiles: boolean; hasError: boolean }): SrSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor structural sample',
      reason: 'Load a tiny dump with Columns/Beams/Slabs, beam, column, footing, and ShopRanker shop-width.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a structural model',
      reason: 'Drop an ASCII .ifc structural dump, JSON, or CSV — or load the sample shop floor.',
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
