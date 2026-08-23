import { AI_MAX_FILE_BYTES, AI_SUPPORTED_EXTENSIONS } from '../constants/ai-file-viewer.constants';
import type { AiArtboard, AiDataset, AiLayer, AiLoadedFile, AiMetadataRow, AiPath, AiSuggestion } from '../types/ai-file-viewer.types';
import { buildSampleAiBytes, parseAiBytes } from './ai-file-viewer-parse.utils';

export {
  buildSampleAiBytes,
  buildSampleAiJson,
  filterAiArtboards,
  filterAiLayers,
  filterAiPaths,
  filterAiRows,
  parseAiBytes,
  parseAiText
} from './ai-file-viewer-parse.utils';

export { canvasToPngDataUrl, defaultAiView, downloadDataUrl, fitAiView, renderAiPreview } from './ai-file-viewer-render.utils';

export function formatAiFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAiFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readAiFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedAiFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (AI_SUPPORTED_EXTENSIONS as readonly string[]).includes(getAiFileExtension(file.name));
}

export function validateAiFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > AI_MAX_FILE_BYTES) return `File is too large (max ${formatAiFileSize(AI_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidAiFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed AI files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedAiFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .ai, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateAiFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleAiFile(): File {
  return new File([buildSampleAiBytes() as BlobPart], 'sample-shop-floor.ai', { type: 'application/illustrator', lastModified: 0 });
}

export function createAiFileRecord(file: File, bytes: Uint8Array): AiLoadedFile {
  const extension = getAiFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: AiDataset | null = null;
  let softFail = false;
  try {
    parsed = parseAiBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.paths.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse AI dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportAi(file: AiLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildAiMetadataRows(dataset: AiDataset): AiMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'AI', value: dataset.aiVer || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Artboards', value: String(dataset.artboardCount) },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Paths', value: String(dataset.pathCount) }
  ];
}

export function buildAiArtboardMetadata(board: AiArtboard): AiMetadataRow[] {
  return [
    { key: 'Name', value: board.name },
    { key: 'Origin', value: `${board.x}, ${board.y}` },
    { key: 'Size', value: `${board.w} × ${board.h}` }
  ];
}

export function buildAiLayerMetadata(layer: AiLayer): AiMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Color', value: layer.colorHex },
    { key: 'Paths', value: String(layer.pathCount) }
  ];
}

export function buildAiPathMetadata(path: AiPath): AiMetadataRow[] {
  return [
    { key: 'Name', value: path.name },
    { key: 'Kind', value: path.kind },
    { key: 'Artboard', value: path.artboard },
    { key: 'Layer', value: path.layer },
    { key: 'Color', value: path.colorHex },
    { key: 'Origin', value: `${path.x}, ${path.y}` },
    { key: 'Size', value: path.kind === 'circle' ? `r ${path.r}` : `${path.w} × ${path.h}` },
    { key: 'Text', value: path.text || '—' }
  ];
}

export function exportAiSummaryJson(file: AiLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed AI dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      aiVer: parsed.aiVer,
      width: parsed.width,
      height: parsed.height,
      artboards: parsed.artboards.map((a) => ({ name: a.name, x: a.x, y: a.y, w: a.w, h: a.h })),
      layers: parsed.layers.map((l) => ({ name: l.name, colorHex: l.colorHex, pathCount: l.pathCount })),
      paths: parsed.paths.map((p) => ({
        name: p.name,
        kind: p.kind,
        artboard: p.artboard,
        layer: p.layer,
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

export function exportAiSchemaCsv(dataset: AiDataset): string {
  const lines = ['kind,name,type,artboard,layer,value'];
  for (const a of dataset.artboards) {
    lines.push(['artboard', csv(a.name), 'board', csv(a.name), '', csv(`${a.w}x${a.h}`)].join(','));
  }
  for (const l of dataset.layers) {
    lines.push(['layer', csv(l.name), csv(l.colorHex), '', csv(l.name), csv(l.colorHex)].join(','));
  }
  for (const p of dataset.paths) {
    const value = p.text || (p.kind === 'circle' ? String(p.r) : p.kind === 'line' ? 'aisle' : `${p.w}x${p.h}`);
    lines.push(['path', csv(p.name), csv(p.kind), csv(p.artboard), csv(p.layer), csv(value)].join(','));
  }
  return lines.join('\n');
}

export function exportAiRowsCsv(dataset: AiDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveAiSuggestion(state: { hasFiles: boolean; hasError: boolean }): AiSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor Illustrator sample',
      reason: 'Load a tiny artboard with slab, counter, storage, column, aisle, and ShopRanker label.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an Illustrator file',
      reason: 'Drop an .ai dump, JSON, or CSV — or load the sample shop floor artboard.',
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
