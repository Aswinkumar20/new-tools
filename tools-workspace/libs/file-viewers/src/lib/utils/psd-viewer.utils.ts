import { PD_MAX_FILE_BYTES, PD_SUPPORTED_EXTENSIONS } from '../constants/psd-viewer.constants';
import type { PdChannel, PdDataset, PdEffect, PdLayer, PdLoadedFile, PdMetadataRow, PdSuggestion } from '../types/psd-viewer.types';
import { buildSamplePdBytes, parsePdBytes } from './psd-viewer-parse.utils';

export {
  buildSamplePdBytes,
  buildSamplePdJson,
  filterPdChannels,
  filterPdEffects,
  filterPdLayers,
  filterPdRows,
  parsePdBytes,
  parsePdText
} from './psd-viewer-parse.utils';

export { canvasToPngDataUrl, defaultPdView, downloadDataUrl, fitPdView, renderPdPreview } from './psd-viewer-render.utils';

export function formatPdFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getPdFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readPdFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedPdFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (PD_SUPPORTED_EXTENSIONS as readonly string[]).includes(getPdFileExtension(file.name));
}

export function validatePdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > PD_MAX_FILE_BYTES) return `File is too large (max ${formatPdFileSize(PD_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidPdFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed PSD files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedPdFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .psd, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validatePdFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSamplePdFile(): File {
  return new File([buildSamplePdBytes() as BlobPart], 'sample-shop-floor.psd', { type: 'image/vnd.adobe.photoshop', lastModified: 0 });
}

export function createPdFileRecord(file: File, bytes: Uint8Array): PdLoadedFile {
  const extension = getPdFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: PdDataset | null = null;
  let softFail = false;
  try {
    parsed = parsePdBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.layers.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse PSD dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportPd(file: PdLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildPdMetadataRows(dataset: PdDataset): PdMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'PSD', value: dataset.psdVer || '—' },
    { key: 'Size', value: `${dataset.width} × ${dataset.height}` },
    { key: 'Layers', value: String(dataset.layerCount) },
    { key: 'Effects', value: String(dataset.effectCount) },
    { key: 'Channels', value: String(dataset.channelCount) }
  ];
}

export function buildPdLayerMetadata(layer: PdLayer): PdMetadataRow[] {
  return [
    { key: 'Name', value: layer.name },
    { key: 'Kind', value: layer.kind },
    { key: 'Visible', value: layer.visible ? 'yes' : 'no' },
    { key: 'Color', value: layer.colorHex },
    { key: 'Origin', value: `${layer.x}, ${layer.y}` },
    { key: 'Size', value: layer.kind === 'circle' ? `r ${layer.r}` : `${layer.w} × ${layer.h}` },
    { key: 'Text', value: layer.text || '—' }
  ];
}

export function buildPdEffectMetadata(effect: PdEffect): PdMetadataRow[] {
  return [
    { key: 'Name', value: effect.name },
    { key: 'Kind', value: effect.kind },
    { key: 'Layer', value: effect.layer }
  ];
}

export function buildPdChannelMetadata(channel: PdChannel): PdMetadataRow[] {
  return [{ key: 'Name', value: channel.name }];
}

export function exportPdSummaryJson(file: PdLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed PSD dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      psdVer: parsed.psdVer,
      width: parsed.width,
      height: parsed.height,
      channels: parsed.channels.map((c) => ({ name: c.name })),
      layers: parsed.layers.map((l) => ({
        name: l.name,
        kind: l.kind,
        visible: l.visible,
        colorHex: l.colorHex,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        r: l.r,
        text: l.text
      })),
      effects: parsed.effects.map((e) => ({ name: e.name, layer: e.layer, kind: e.kind })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportPdSchemaCsv(dataset: PdDataset): string {
  const lines = ['kind,name,type,layer,effect,value'];
  for (const c of dataset.channels) {
    lines.push(['channel', csv(c.name), 'channel', csv(c.name), '', csv(c.name)].join(','));
  }
  for (const l of dataset.layers) {
    const value = l.text || (l.kind === 'circle' ? String(l.r) : l.kind === 'line' ? 'aisle' : `${l.w}x${l.h}`);
    lines.push(['layer', csv(l.name), csv(l.kind), csv(l.name), '', csv(value)].join(','));
  }
  for (const e of dataset.effects) {
    lines.push(['effect', csv(e.name), csv(e.kind), csv(e.layer), csv(e.name), csv(e.kind)].join(','));
  }
  return lines.join('\n');
}

export function exportPdRowsCsv(dataset: PdDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolvePdSuggestion(state: { hasFiles: boolean; hasError: boolean }): PdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopFloor PSD sample',
      reason: 'Load a tiny composite with slab, counter, storage, column, aisle, ShopRanker, and two effects.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a PSD file',
      reason: 'Drop a .psd dump, JSON, or CSV — or load the sample shop floor composite.',
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
