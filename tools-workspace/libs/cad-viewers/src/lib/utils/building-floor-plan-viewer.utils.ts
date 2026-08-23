import { FP_MAX_FILE_BYTES, FP_SUPPORTED_EXTENSIONS } from '../constants/building-floor-plan-viewer.constants';
import type { FpDataset, FpLevel, FpLoadedFile, FpMetadataRow, FpRoom, FpSpace, FpSuggestion } from '../types/building-floor-plan-viewer.types';
import { buildSampleFpBytes, parseFpBytes } from './building-floor-plan-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatFpFileSize,
  readFileBytes as readFpFileBytes
} from './cad-file.utils';

export {
  buildSampleFpBytes,
  buildSampleFpJson,
  filterFpLevels,
  filterFpRooms,
  filterFpRows,
  filterFpSpaces,
  parseFpBytes,
  parseFpText
} from './building-floor-plan-viewer-parse.utils';
export { fpTypeColor, renderFpLevels, renderFpPlan, toFpCadGeom } from './building-floor-plan-viewer-render.utils';

export function isSupportedFpFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validateFpFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FP_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(FP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFpFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: FP_SUPPORTED_EXTENSIONS,
    maxBytes: FP_MAX_FILE_BYTES,
    formatsLabel: '.ifc, .ifcxml, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed floor-plan files are not supported — decompress first'
  });
}

export function createSampleFpFile(): File {
  return new File([cadBytesToBlobPart(buildSampleFpBytes())], 'hotel-l3.ifc', { type: 'application/x-step', lastModified: 0 });
}

export function createFpFileRecord(file: File, bytes: Uint8Array): FpLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FpDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFpBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.spaces.length && !parsed.rooms.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse floor-plan dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFp(file: FpLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFpMetadataRows(dataset: FpDataset): FpMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Plan', value: dataset.planVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Levels', value: String(dataset.levelCount) },
    { key: 'Rooms', value: String(dataset.roomCount) },
    { key: 'Spaces', value: String(dataset.spaceCount) }
  ];
}

export function buildFpSpaceMetadata(space: FpSpace): FpMetadataRow[] {
  return [
    { key: 'Name', value: space.name },
    { key: 'Kind', value: space.kind },
    { key: 'Level', value: space.level },
    { key: 'Draw', value: space.drawType },
    { key: 'Origin', value: `${space.x}, ${space.y}` },
    { key: 'Size', value: space.kind === 'column' ? `r ${space.r}` : `${space.x2}, ${space.y2}` }
  ];
}

export function buildFpRoomMetadata(room: FpRoom): FpMetadataRow[] {
  return [
    { key: 'Name', value: room.name },
    { key: 'Level', value: room.level },
    { key: 'Bounds', value: `${room.x}, ${room.y} → ${room.x2}, ${room.y2}` },
    { key: 'Area', value: String(room.area) }
  ];
}

export function buildFpLevelMetadata(level: FpLevel): FpMetadataRow[] {
  return [
    { key: 'Name', value: level.name },
    { key: 'Elevation', value: String(level.elevation) },
    { key: 'Description', value: level.description || '—' },
    { key: 'Rooms', value: String(level.roomCount) }
  ];
}

export function exportFpSummaryJson(file: FpLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed floor-plan dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      planVer: parsed.planVer,
      units: parsed.units,
      levels: parsed.levels.map((d) => ({ name: d.name, elevation: d.elevation, description: d.description, roomCount: d.roomCount })),
      rooms: parsed.rooms.map((r) => ({ name: r.name, level: r.level, x: r.x, y: r.y, x2: r.x2, y2: r.y2, area: r.area })),
      spaces: parsed.spaces.map((e) => ({
        name: e.name,
        kind: e.kind,
        level: e.level,
        x: e.x,
        y: e.y,
        x2: e.x2,
        y2: e.y2,
        r: e.r,
        text: e.text
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportFpSchemaCsv(dataset: FpDataset): string {
  const lines = ['kind,name,type,level,room,x'];
  for (const d of dataset.levels) {
    lines.push(['level', csv(d.name), 'level', csv(d.name), '', csv(String(d.elevation))].join(','));
  }
  for (const r of dataset.rooms) {
    lines.push(['room', csv(r.name), 'room', csv(r.level), csv(r.name), csv(String(r.x))].join(','));
  }
  for (const e of dataset.spaces) {
    lines.push(['space', csv(e.name), csv(e.kind), csv(e.level), e.kind === 'room' ? csv(e.name) : '', csv(String(e.x))].join(','));
  }
  return lines.join('\n');
}

export function exportFpRowsCsv(dataset: FpDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveFpSuggestion(state: { hasFiles: boolean; hasError: boolean }): FpSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor plan sample',
      reason: 'Load a tiny dump with Ground/Mezzanine, ShopFloor/Counter/Storage rooms, column, aisle, and ShopRanker.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a building floor plan',
      reason: 'Drop an ASCII .ifc plan dump, JSON, or CSV — or load the sample shop floor.',
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
