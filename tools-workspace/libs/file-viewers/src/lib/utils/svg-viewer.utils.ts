import { SV_MAX_FILE_BYTES, SV_SUPPORTED_EXTENSIONS } from '../constants/svg-viewer.constants';
import type { SvDataset, SvLayer, SvLoadedFile, SvMetadataRow, SvShape, SvSuggestion } from '../types/svg-viewer.types';
import { buildSampleSvBytes, parseSvBytes } from './svg-viewer-parse.utils';

export {
  buildSampleSvBytes,
  buildSampleSvJson,
  filterSvLayers,
  filterSvRows,
  filterSvShapes,
  parseSvBytes,
  parseSvText
} from './svg-viewer-parse.utils';

export { canvasToPngDataUrl, defaultSvView, downloadDataUrl, fitSvView, renderSvPreview } from './svg-viewer-render.utils';

export function formatSvFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSvFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readSvFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedSvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getSvFileExtension(file.name));
}

export function validateSvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SV_MAX_FILE_BYTES) return `File is too large (max ${formatSvFileSize(SV_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSvFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SVG files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSvFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .svg, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateSvFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSvFile(): File {
  return new File([buildSampleSvBytes() as BlobPart], 'sample-shop-floor.svg', { type: 'image/svg+xml', lastModified: 0 });
}

export function createSvFileRecord(file: File, bytes: Uint8Array): SvLoadedFile {
  const extension = getSvFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSvBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.shapes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SVG dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSv(file: SvLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSvMetadataRows(dataset: SvDataset): SvMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'SVG', value: dataset.svgVer || '—' },
    { key: 'ViewBox', value: dataset.viewBox || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Shapes', value: String(dataset.shapeCount) },
    { key: 'Layers', value: String(dataset.layerCount) }
  ];
}

export function buildSvShapeMetadata(shape: SvShape): SvMetadataRow[] {
  return [
    { key: 'Name', value: shape.name },
    { key: 'Kind', value: shape.kind },
    { key: 'Layer', value: shape.layer },
    { key: 'Color', value: shape.colorHex },
    { key: 'Origin', value: `${shape.x}, ${shape.y}` },
    { key: 'Size', value: shape.kind === 'circle' ? `r ${shape.r}` : `${shape.w} × ${shape.h}` },
    { key: 'Text', value: shape.text || '—' }
  ];
}

export function buildSvLayerMetadata(layer: SvLayer): SvMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: layer.colorHex },
    { key: 'Shapes', value: String(layer.shapeCount) }
  ];
}

export function exportSvSummaryJson(file: SvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SVG dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      svgVer: parsed.svgVer,
      viewBox: parsed.viewBox,
      width: parsed.width,
      height: parsed.height,
      layers: parsed.layers.map((l) => ({ name: l.name, colorHex: l.colorHex, shapeCount: l.shapeCount })),
      shapes: parsed.shapes.map((s) => ({
        name: s.name,
        kind: s.kind,
        layer: s.layer,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        r: s.r,
        text: s.text
      })),
      sourceText: parsed.sourceText,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportSvSchemaCsv(dataset: SvDataset): string {
  const lines = ['kind,name,type,layer,shape,value'];
  for (const l of dataset.layers) {
    lines.push(['layer', csv(l.name), csv(l.colorHex), csv(l.name), '', csv(l.colorHex)].join(','));
  }
  for (const s of dataset.shapes) {
    const kind = s.kind === 'text' ? 'text' : 'shape';
    const value = s.text || (s.kind === 'circle' ? String(s.r) : s.kind === 'line' ? 'aisle' : `${s.w}x${s.h}`);
    lines.push([kind, csv(s.name), csv(s.kind), csv(s.layer), csv(s.name), csv(value)].join(','));
  }
  return lines.join('\n');
}

export function exportSvRowsCsv(dataset: SvDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function exportSvSourceSvg(dataset: SvDataset): string {
  return dataset.sourceText || '';
}

export function resolveSvSuggestion(state: { hasFiles: boolean; hasError: boolean }): SvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor SVG sample',
      reason: 'Load a tiny 12×8 shop plan with slab, counter, storage, column, aisle, and ShopRanker label.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an SVG file',
      reason: 'Drop a .svg dump, XML, JSON, or CSV — or load the sample shop floor.',
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
