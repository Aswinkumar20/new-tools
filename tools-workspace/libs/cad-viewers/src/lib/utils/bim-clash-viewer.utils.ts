import { BC_MAX_FILE_BYTES, BC_SUPPORTED_EXTENSIONS } from '../constants/bim-clash-viewer.constants';
import type { BcClash, BcDataset, BcItem, BcLoadedFile, BcMetadataRow, BcSuggestion, BcTest } from '../types/bim-clash-viewer.types';
import { buildSampleBcBytes, parseBcBytes } from './bim-clash-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  sizeCadCanvas,
  formatCadFileSize as formatBcFileSize,
  readFileBytes as readBcFileBytes
} from './cad-file.utils';
export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';

export {
  buildSampleBcBytes,
  buildSampleBcJson,
  filterBcClashes,
  filterBcItems,
  filterBcRows,
  filterBcTests,
  parseBcBytes,
  parseBcText
} from './bim-clash-viewer-parse.utils';
export { bcTypeColor, renderBcFocus, renderBcTests, toBcCad3d } from './bim-clash-viewer-render.utils';

export function isSupportedBcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (BC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateBcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > BC_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(BC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidBcFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: BC_SUPPORTED_EXTENSIONS,
    maxBytes: BC_MAX_FILE_BYTES,
    formatsLabel: '.xml, .ifc, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed clash reports are not supported — decompress first'
  });
}

export function createSampleBcFile(): File {
  return new File([cadBytesToBlobPart(buildSampleBcBytes())], 'duct-beam-clash.xml', { type: 'application/xml', lastModified: 0 });
}

export function createBcFileRecord(file: File, bytes: Uint8Array): BcLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: BcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseBcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.items.length && !parsed.clashes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse BIM clash dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportBc(file: BcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildBcMetadataRows(dataset: BcDataset): BcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Report', value: dataset.reportVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Items', value: String(dataset.itemCount) },
    { key: 'Clashes', value: String(dataset.clashCount) },
    { key: 'Tests', value: String(dataset.testCount) }
  ];
}

export function buildBcItemMetadata(item: BcItem): BcMetadataRow[] {
  return [
    { key: 'Name', value: item.name },
    { key: 'Kind', value: item.kind },
    { key: 'Test', value: item.test },
    { key: 'Center', value: `${item.cx}, ${item.cy}, ${item.cz}` },
    {
      key: 'Size',
      value: item.kind === 'cylinder' ? `r ${item.r} · h ${item.h}` : `${item.sx} × ${item.sy} × ${item.sz}`
    },
    { key: 'Volume', value: String(item.volume) }
  ];
}

export function buildBcClashMetadata(clash: BcClash): BcMetadataRow[] {
  return [
    { key: 'Name', value: clash.name },
    { key: 'Type', value: clash.clashType },
    { key: 'Status', value: clash.status },
    { key: 'Test', value: clash.test || '—' },
    { key: 'Item A', value: clash.itemA || '—' },
    { key: 'Item B', value: clash.itemB || '—' },
    { key: 'Distance', value: String(clash.distance) },
    { key: 'Focus', value: `${clash.cx}, ${clash.cy}, ${clash.cz}` }
  ];
}

export function buildBcTestMetadata(test: BcTest): BcMetadataRow[] {
  return [
    { key: 'Name', value: test.name },
    { key: 'Description', value: test.description || '—' },
    { key: 'Clashes', value: String(test.clashCount) }
  ];
}

export function exportBcSummaryJson(file: BcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed BIM clash dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      reportVer: parsed.reportVer,
      units: parsed.units,
      items: parsed.items.map((e) => ({
        name: e.name,
        kind: e.kind,
        test: e.test,
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
        test: c.test,
        itemA: c.itemA,
        itemB: c.itemB,
        distance: c.distance,
        cx: c.cx,
        cy: c.cy,
        cz: c.cz
      })),
      tests: parsed.tests.map((d) => ({ name: d.name, description: d.description, clashCount: d.clashCount })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportBcSchemaCsv(dataset: BcDataset): string {
  const lines = ['kind,name,type,test,clash,value'];
  for (const e of dataset.items) {
    lines.push(['item', csv(e.name), csv(e.kind), csv(e.test), '', csv(e.kind)].join(','));
  }
  for (const c of dataset.clashes) {
    lines.push(['clash', csv(c.name), csv(c.clashType), csv(c.test), csv(c.name), csv(`${c.itemA}|${c.itemB}`)].join(','));
  }
  for (const d of dataset.tests) {
    lines.push(['test', csv(d.name), 'test', csv(d.name), '', csv(d.description)].join(','));
  }
  return lines.join('\n');
}

export function exportBcRowsCsv(dataset: BcDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveBcSuggestion(state: { hasFiles: boolean; hasError: boolean }): BcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor clash sample',
      reason: 'Load a tiny report with ShopRankerCoordination, CL-01 hard column/duct, and CL-02 clearance.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a BIM clash report',
      reason: 'Drop an ASCII clash dump, XML, JSON, or CSV — or load the sample shop floor.',
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
