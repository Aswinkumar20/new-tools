import { RT_MAX_FILE_BYTES, RT_SUPPORTED_EXTENSIONS } from '../constants/rtf-viewer.constants';
import type { RtBlock, RtDataset, RtLoadedFile, RtMetadataRow, RtSpan, RtStyle, RtSuggestion } from '../types/rtf-viewer.types';
import { buildSampleRtBytes, parseRtBytes } from './rtf-viewer-parse.utils';

export {
  buildSampleRtBytes,
  buildSampleRtJson,
  exportRtHtml,
  filterRtBlocks,
  filterRtRows,
  filterRtSpans,
  filterRtStyles,
  parseRtBytes,
  parseRtText
} from './rtf-viewer-parse.utils';

export function formatRtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getRtFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readRtFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedRtFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (RT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getRtFileExtension(file.name));
}

export function validateRtFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > RT_MAX_FILE_BYTES) return `File is too large (max ${formatRtFileSize(RT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidRtFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed RTF files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedRtFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .rtf, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateRtFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleRtFile(): File {
  return new File([buildSampleRtBytes() as BlobPart], 'sample-shop-ranker.rtf', { type: 'application/rtf', lastModified: 0 });
}

export function createRtFileRecord(file: File, bytes: Uint8Array): RtLoadedFile {
  const extension = getRtFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: RtDataset | null = null;
  let softFail = false;
  try {
    parsed = parseRtBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.styles.length && !parsed.blocks.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse RTF dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportRt(file: RtLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRtMetadataRows(dataset: RtDataset): RtMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Author', value: dataset.author || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'RTF', value: dataset.rtfVer || '—' },
    { key: 'Styles', value: String(dataset.styleCount) },
    { key: 'Blocks', value: String(dataset.blockCount) }
  ];
}

export function buildRtStyleMetadata(style: RtStyle): RtMetadataRow[] {
  return [
    { key: 'Name', value: style.name },
    { key: 'Kind', value: style.kind },
    { key: 'Weight', value: style.weight || '—' },
    { key: 'Size', value: style.size || '—' }
  ];
}

export function buildRtBlockMetadata(block: RtBlock): RtMetadataRow[] {
  return [
    { key: 'Name', value: block.name },
    { key: 'Kind', value: block.kind },
    { key: 'Text', value: block.text || '—' }
  ];
}

export function buildRtSpanMetadata(span: RtSpan): RtMetadataRow[] {
  return [
    { key: 'Name', value: span.name },
    { key: 'Kind', value: span.kind },
    { key: 'Style', value: span.style || '—' },
    { key: 'Text', value: span.text || '—' }
  ];
}

export function exportRtSummaryJson(file: RtLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed RTF dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      author: parsed.author,
      rtfVer: parsed.rtfVer,
      styles: parsed.styles.map((s) => ({ name: s.name, kind: s.kind, weight: s.weight, size: s.size })),
      blocks: parsed.blocks.map((b) => ({ name: b.name, kind: b.kind, text: b.text })),
      spans: parsed.spans.map((s) => ({ name: s.name, kind: s.kind, style: s.style, text: s.text })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportRtSchemaCsv(dataset: RtDataset): string {
  const lines = ['kind,name,type,style,block,value'];
  for (const s of dataset.styles) lines.push(['style', csv(s.name), csv(s.kind), csv(s.name), '', csv(`${s.weight} ${s.size}`)].join(','));
  for (const b of dataset.blocks) lines.push(['block', csv(b.name), csv(b.kind), '', csv(b.name), csv(b.text)].join(','));
  for (const s of dataset.spans) lines.push(['span', csv(s.name), csv(s.kind), csv(s.style), '', csv(s.text)].join(','));
  return lines.join('\n');
}

export function exportRtRowsCsv(dataset: RtDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveRtSuggestion(state: { hasFiles: boolean; hasError: boolean }): RtSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker RTF sample',
      reason: 'Load a tiny RTF dump with heading/emphasis styles, ShopRanker text, and HTML export.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an RTF file',
      reason: 'Drop a .rtf dump, JSON, or CSV — or load the sample handbook notes.',
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
