import { TF_MAX_FILE_BYTES, TF_SUPPORTED_EXTENSIONS } from '../constants/tiff-viewer.constants';
import type { TfDataset, TfLoadedFile, TfMeta, TfMetadataRow, TfPage, TfSuggestion } from '../types/tiff-viewer.types';
import { buildSampleTfBytes, parseTfBytes } from './tiff-viewer-parse.utils';

export {
  buildSampleTfBytes,
  buildSampleTfJson,
  filterTfMetas,
  filterTfPages,
  filterTfPreviews,
  filterTfRows,
  parseTfBytes,
  parseTfText
} from './tiff-viewer-parse.utils';

export { canvasToPngDataUrl, defaultTfView, downloadDataUrl, fitTfView, renderTfPreview } from './tiff-viewer-render.utils';

export function formatTfFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getTfFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readTfFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedTfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getTfFileExtension(file.name));
}

export function validateTfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TF_MAX_FILE_BYTES) return `File is too large (max ${formatTfFileSize(TF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed TIFF files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .tif, .tiff, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateTfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTfFile(): File {
  return new File([buildSampleTfBytes() as BlobPart], 'sample-shop-floor.tiff', { type: 'image/tiff', lastModified: 0 });
}

export function createTfFileRecord(file: File, bytes: Uint8Array): TfLoadedFile {
  const extension = getTfFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTfBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.pages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse TIFF dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTf(file: TfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTfMetadataRows(dataset: TfDataset): TfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'TIFF', value: dataset.tiffVer || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Compression', value: dataset.compression || '—' },
    { key: 'Photometric', value: dataset.photometric || '—' },
    { key: 'Pages', value: String(dataset.pageCount) },
    { key: 'Metadata', value: String(dataset.metaCount) }
  ];
}

export function buildTfPageMetadata(page: TfPage): TfMetadataRow[] {
  return [
    { key: 'Name', value: page.name },
    { key: 'Kind', value: page.kind },
    { key: 'Size', value: `${page.width} × ${page.height}` }
  ];
}

export function buildTfMetaMetadata(meta: TfMeta): TfMetadataRow[] {
  return [
    { key: 'Name', value: meta.name },
    { key: 'Value', value: meta.value || '—' }
  ];
}

export function exportTfSummaryJson(file: TfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed TIFF dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      tiffVer: parsed.tiffVer,
      width: parsed.width,
      height: parsed.height,
      compression: parsed.compression,
      photometric: parsed.photometric,
      pages: parsed.pages.map((p) => ({ name: p.name, kind: p.kind, width: p.width, height: p.height })),
      metas: parsed.metas.map((m) => ({ name: m.name, value: m.value })),
      previews: parsed.previews.map((p) => ({
        name: p.name,
        kind: p.kind,
        page: p.page,
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

export function exportTfSchemaCsv(dataset: TfDataset): string {
  const lines = ['kind,name,type,page,meta,value'];
  for (const p of dataset.pages) {
    lines.push(['page', csv(p.name), csv(p.kind), csv(p.name), '', csv(`${p.width}x${p.height}`)].join(','));
  }
  for (const m of dataset.metas) {
    lines.push(['meta', csv(m.name), 'meta', '', csv(m.name), csv(m.value)].join(','));
  }
  return lines.join('\n');
}

export function exportTfRowsCsv(dataset: TfDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveTfSuggestion(state: { hasFiles: boolean; hasError: boolean }): TfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor TIFF sample',
      reason: 'Load a tiny multi-page dump with cover/floor pages, metadata, and a ShopRanker preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a TIFF file',
      reason: 'Drop a .tif / .tiff dump, JSON, or CSV — or load the sample shop floor scan.',
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
