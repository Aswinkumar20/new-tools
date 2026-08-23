import { HC_MAX_FILE_BYTES, HC_SUPPORTED_EXTENSIONS } from '../constants/heic-viewer.constants';
import type { HcDataset, HcFrame, HcLoadedFile, HcMeta, HcMetadataRow, HcSuggestion } from '../types/heic-viewer.types';
import { buildSampleHcBytes, parseHcBytes } from './heic-viewer-parse.utils';

export {
  buildSampleHcBytes,
  buildSampleHcJson,
  filterHcFrames,
  filterHcMetas,
  filterHcPreviews,
  filterHcRows,
  parseHcBytes,
  parseHcText
} from './heic-viewer-parse.utils';

export { canvasToPngDataUrl, defaultHcView, downloadDataUrl, fitHcView, renderHcPreview } from './heic-viewer-render.utils';

export function formatHcFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getHcFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readHcFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function isSupportedHcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (HC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getHcFileExtension(file.name));
}

export function validateHcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > HC_MAX_FILE_BYTES) return `File is too large (max ${formatHcFileSize(HC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidHcFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (/\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'Compressed HEIC files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedHcFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .heic, .heif, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateHcFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleHcFile(): File {
  return new File([buildSampleHcBytes() as BlobPart], 'sample-shop-floor.heic', { type: 'image/heic', lastModified: 0 });
}

export function createHcFileRecord(file: File, bytes: Uint8Array): HcLoadedFile {
  const extension = getHcFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: HcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseHcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.frames.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse HEIC dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportHc(file: HcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildHcMetadataRows(dataset: HcDataset): HcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'HEIC', value: dataset.heicVer || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Make', value: dataset.make || '—' },
    { key: 'Model', value: dataset.model || '—' },
    { key: 'Frames', value: String(dataset.frameCount) },
    { key: 'Metadata', value: String(dataset.metaCount) }
  ];
}

export function buildHcFrameMetadata(frame: HcFrame): HcMetadataRow[] {
  return [
    { key: 'Name', value: frame.name },
    { key: 'Kind', value: frame.kind },
    { key: 'Size', value: `${frame.width} × ${frame.height}` }
  ];
}

export function buildHcMetaMetadata(meta: HcMeta): HcMetadataRow[] {
  return [
    { key: 'Name', value: meta.name },
    { key: 'Group', value: meta.group },
    { key: 'Value', value: meta.value || '—' }
  ];
}

export function exportHcSummaryJson(file: HcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HEIC dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      heicVer: parsed.heicVer,
      width: parsed.width,
      height: parsed.height,
      make: parsed.make,
      model: parsed.model,
      frames: parsed.frames.map((f) => ({ name: f.name, kind: f.kind, width: f.width, height: f.height })),
      metas: parsed.metas.map((m) => ({ name: m.name, group: m.group, value: m.value })),
      previews: parsed.previews.map((p) => ({
        name: p.name,
        kind: p.kind,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        r: p.r,
        text: p.text
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportHcSchemaCsv(dataset: HcDataset): string {
  const lines = ['kind,name,type,frame,meta,value'];
  for (const f of dataset.frames) {
    lines.push(['frame', csv(f.name), csv(f.kind), csv(f.name), '', csv(`${f.width}x${f.height}`)].join(','));
  }
  for (const m of dataset.metas) {
    lines.push([m.group, csv(m.name), csv(m.group), '', csv(m.name), csv(m.value)].join(','));
  }
  return lines.join('\n');
}

export function exportHcRowsCsv(dataset: HcDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveHcSuggestion(state: { hasFiles: boolean; hasError: boolean }): HcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor HEIC sample',
      reason: 'Load a tiny photo dump with primary/thumbnail frames, EXIF, and a ShopRanker preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a HEIC file',
      reason: 'Drop a .heic dump, JSON, or CSV — or load the sample shop floor photo.',
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
