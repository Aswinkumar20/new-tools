import { RW_MAX_FILE_BYTES, RW_SUPPORTED_EXTENSIONS } from '../constants/raw-image-viewer.constants';
import type { RwChannel, RwDataset, RwExif, RwLoadedFile, RwMetadataRow, RwSuggestion } from '../types/raw-image-viewer.types';
import { buildSampleRwBytes, parseRwBytes } from './raw-image-viewer-parse.utils';

export {
  buildSampleRwBytes,
  buildSampleRwJson,
  filterRwChannels,
  filterRwExifs,
  filterRwPreviews,
  filterRwRows,
  parseRwBytes,
  parseRwText
} from './raw-image-viewer-parse.utils';

export { canvasToPngDataUrl, defaultRwView, downloadDataUrl, fitRwView, renderRwPreview } from './raw-image-viewer-render.utils';

export function formatRwFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getRwFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readRwFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedRwFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (RW_SUPPORTED_EXTENSIONS as readonly string[]).includes(getRwFileExtension(file.name));
}

export function validateRwFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RW_MAX_FILE_BYTES) return `File is too large (max ${formatRwFileSize(RW_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidRwFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed RAW files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedRwFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .cr2, .nef, .arw, .dng, .raw, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateRwFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleRwFile(): File {
  return new File([buildSampleRwBytes() as BlobPart], 'sample-shop-floor.cr2', { type: 'image/x-canon-cr2', lastModified: 0 });
}

export function createRwFileRecord(file: File, bytes: Uint8Array): RwLoadedFile {
  const extension = getRwFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: RwDataset | null = null;
  let softFail = false;
  try {
    parsed = parseRwBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.channels.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse RAW dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportRw(file: RwLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRwMetadataRows(dataset: RwDataset): RwMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'RAW', value: dataset.rawVer || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Make', value: dataset.make || '—' },
    { key: 'Model', value: dataset.model || '—' },
    { key: 'Format', value: dataset.format || '—' },
    { key: 'ISO', value: dataset.iso || '—' },
    { key: 'Demosaic', value: dataset.demosaic || '—' },
    { key: 'Channels', value: String(dataset.channelCount) },
    { key: 'EXIF', value: String(dataset.exifCount) }
  ];
}

export function buildRwChannelMetadata(channel: RwChannel): RwMetadataRow[] {
  return [
    { key: 'Name', value: channel.name },
    { key: 'Kind', value: channel.kind },
    { key: 'Pattern', value: channel.pattern || '—' }
  ];
}

export function buildRwExifMetadata(exif: RwExif): RwMetadataRow[] {
  return [
    { key: 'Name', value: exif.name },
    { key: 'Value', value: exif.value || '—' }
  ];
}

export function exportRwSummaryJson(file: RwLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed RAW dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      rawVer: parsed.rawVer,
      width: parsed.width,
      height: parsed.height,
      make: parsed.make,
      model: parsed.model,
      format: parsed.format,
      iso: parsed.iso,
      demosaic: parsed.demosaic,
      channels: parsed.channels.map((c) => ({ name: c.name, kind: c.kind, pattern: c.pattern })),
      exifs: parsed.exifs.map((e) => ({ name: e.name, value: e.value })),
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

export function exportRwSchemaCsv(dataset: RwDataset): string {
  const lines = ['kind,name,type,channel,exif,value'];
  for (const c of dataset.channels) {
    lines.push(['channel', csv(c.name), csv(c.kind), csv(c.name), '', csv(c.pattern)].join(','));
  }
  for (const e of dataset.exifs) {
    lines.push(['exif', csv(e.name), 'exif', '', csv(e.name), csv(e.value)].join(','));
  }
  return lines.join('\n');
}

export function exportRwRowsCsv(dataset: RwDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveRwSuggestion(state: { hasFiles: boolean; hasError: boolean }): RwSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor RAW sample',
      reason: 'Load a tiny CR2 dump with Bayer channels, EXIF, and a ShopRanker demosaic preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a RAW file',
      reason: 'Drop a .cr2 / .nef / .arw dump, JSON, or CSV — or load the sample shop floor photo.',
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
