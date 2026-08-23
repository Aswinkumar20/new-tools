import { PL_MAX_FILE_BYTES, PL_SUPPORTED_EXTENSIONS } from '../constants/plt-plot-viewer.constants';
import type { PlCommand, PlDataset, PlLoadedFile, PlMetadataRow, PlPen, PlSuggestion } from '../types/plt-plot-viewer.types';
import { buildSamplePlBytes, parsePlBytes } from './plt-plot-viewer-parse.utils';
import { bytesToText, formatCadFileSize, getCadFileExtension, cadBytesToBlobPart, filterValidCadFiles } from './cad-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  fitCadView,
  pickCadEntityAtScreen,
  sizeCadCanvas,
  formatCadFileSize as formatPlFileSize,
  readFileBytes as readPlFileBytes
} from './cad-file.utils';

export {
  buildSamplePlBytes,
  buildSamplePlJson,
  filterPlCommands,
  filterPlPens,
  filterPlRows,
  parsePlBytes,
  parsePlText
} from './plt-plot-viewer-parse.utils';
export { plTypeColor, renderPlPens, renderPlPlot, renderPlPreview, toCadGeom } from './plt-plot-viewer-render.utils';

export function isSupportedPlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getCadFileExtension(file.name));
}

export function validatePlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PL_MAX_FILE_BYTES) return `File is too large (max ${formatCadFileSize(PL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPlFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  return filterValidCadFiles(files, {
    extensions: PL_SUPPORTED_EXTENSIONS,
    maxBytes: PL_MAX_FILE_BYTES,
    formatsLabel: '.plt, .json, .csv, .md, or .txt',
    gzipReason: 'Compressed PLT files are not supported — decompress first'
  });
}

export function createSamplePlFile(): File {
  return new File([cadBytesToBlobPart(buildSamplePlBytes())], 'title-block.plt', { type: 'application/vnd.hp-hpgl', lastModified: 0 });
}

export function createPlFileRecord(file: File, bytes: Uint8Array): PlLoadedFile {
  const extension = getCadFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PlDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.pens.length && !parsed.commands.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PLT dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPl(file: PlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPlMetadataRows(dataset: PlDataset): PlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Plotter', value: dataset.plotterVer || '—' },
    { key: 'Units', value: dataset.units || '—' },
    { key: 'Pens', value: String(dataset.penCount) },
    { key: 'Commands', value: String(dataset.commandCount) }
  ];
}

export function buildPlPenMetadata(pen: PlPen): PlMetadataRow[] {
  return [
    { key: 'Name', value: pen.name },
    { key: 'Color', value: `${pen.color} · ${pen.colorHex}` },
    { key: 'Visible', value: pen.visible ? 'yes' : 'no' },
    { key: 'Commands', value: String(pen.commandCount) }
  ];
}

export function buildPlCommandMetadata(command: PlCommand): PlMetadataRow[] {
  return [
    { key: 'Name', value: command.name },
    { key: 'Type', value: command.type },
    { key: 'Pen', value: command.pen },
    { key: 'X', value: String(command.x) },
    { key: 'Y', value: String(command.y) },
    { key: 'X2', value: String(command.x2) },
    { key: 'Y2', value: String(command.y2) },
    { key: 'R', value: command.r ? String(command.r) : '—' },
    { key: 'Text', value: command.text || '—' }
  ];
}

export function exportPlSummaryJson(file: PlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PLT dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      plotterVer: parsed.plotterVer,
      units: parsed.units,
      pens: parsed.pens.map((p) => ({ name: p.name, color: p.color, visible: p.visible, commandCount: p.commandCount })),
      commands: parsed.commands.map((c) => ({
        name: c.name,
        type: c.type,
        pen: c.pen,
        x: c.x,
        y: c.y,
        x2: c.x2,
        y2: c.y2,
        r: c.r,
        text: c.text,
        points: c.points
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPlSchemaCsv(dataset: PlDataset): string {
  const lines = ['kind,name,type,pen,x,y'];
  for (const pen of dataset.pens) {
    lines.push(['pen', csv(pen.name), 'pen', csv(pen.name), '', ''].join(','));
  }
  for (const command of dataset.commands) {
    lines.push(['command', csv(command.name), csv(command.type), csv(command.pen), String(command.x), String(command.y)].join(','));
  }
  return lines.join('\n');
}

export function exportPlRowsCsv(dataset: PlDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolvePlSuggestion(state: { hasFiles: boolean; hasError: boolean }): PlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor PLT sample',
      reason: 'Load a tiny HPGL plot with WALLS, a counter polyline, and a column circle.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PLT plot',
      reason: 'Drop an ASCII .plt, JSON, or CSV — or load the sample shop floor.',
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
