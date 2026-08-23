import { MB_MAX_FILE_BYTES, MB_SUPPORTED_EXTENSIONS } from '../constants/mobi-viewer.constants';
import type { MbChapter, MbDataset, MbLoadedFile, MbMetadataRow, MbSuggestion, MbTocEntry } from '../types/mobi-viewer.types';
import { buildSampleMbBytes, parseMbBytes } from './mobi-viewer-parse.utils';

export {
  buildSampleMbBytes,
  buildSampleMbJson,
  filterMbChapters,
  filterMbRows,
  filterMbToc,
  parseMbBytes,
  parseMbText
} from './mobi-viewer-parse.utils';

export function formatMbFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMbFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readMbFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedMbFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (MB_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMbFileExtension(file.name));
}

export function validateMbFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MB_MAX_FILE_BYTES) return `File is too large (max ${formatMbFileSize(MB_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMbFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed MOBI files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedMbFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mobi, .azw, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateMbFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMbFile(): File {
  return new File([buildSampleMbBytes() as BlobPart], 'sample-shop-ranker.mobi', { type: 'application/x-mobipocket-ebook', lastModified: 0 });
}

export function createMbFileRecord(file: File, bytes: Uint8Array): MbLoadedFile {
  const extension = getMbFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MbDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMbBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.chapters.length && !parsed.toc.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse MOBI dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMb(file: MbLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMbMetadataRows(dataset: MbDataset): MbMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Creator', value: dataset.creator || '—' },
    { key: 'Language', value: dataset.language || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'MOBI', value: dataset.mobiVer || '—' },
    { key: 'Chapters', value: String(dataset.chapterCount) },
    { key: 'TOC', value: String(dataset.tocCount) }
  ];
}

export function buildMbChapterMetadata(chapter: MbChapter): MbMetadataRow[] {
  return [
    { key: 'Name', value: chapter.name },
    { key: 'Title', value: chapter.title },
    { key: 'Href', value: chapter.href || '—' },
    { key: 'Words', value: String(chapter.wordCount) }
  ];
}

export function buildMbTocMetadata(entry: MbTocEntry): MbMetadataRow[] {
  return [
    { key: 'Label', value: entry.label },
    { key: 'Chapter', value: entry.chapter || '—' },
    { key: 'Href', value: entry.href || '—' }
  ];
}

export function exportMbSummaryJson(file: MbLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed MOBI dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      creator: parsed.creator,
      language: parsed.language,
      mobiVer: parsed.mobiVer,
      chapters: parsed.chapters.map((c) => ({
        name: c.name,
        title: c.title,
        href: c.href,
        wordCount: c.wordCount,
        text: c.text
      })),
      toc: parsed.toc.map((t) => ({ label: t.label, href: t.href, chapter: t.chapter })),
      meta: parsed.meta.map((m) => ({ name: m.name, value: m.value })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportMbSchemaCsv(dataset: MbDataset): string {
  const lines = ['kind,name,type,chapter,toc,value'];
  for (const c of dataset.chapters) {
    lines.push(['chapter', csv(c.name), csv(c.title), csv(c.name), csv(c.title), csv(c.text.slice(0, 80))].join(','));
  }
  for (const t of dataset.toc) {
    lines.push(['toc', csv(t.label), 'toc', csv(t.chapter), csv(t.label), csv(t.href)].join(','));
  }
  for (const m of dataset.meta) {
    lines.push(['meta', csv(m.name), 'meta', csv(m.name), '', csv(m.value)].join(','));
  }
  return lines.join('\n');
}

export function exportMbRowsCsv(dataset: MbDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function exportMbChapterTxt(chapter: MbChapter | null): string {
  if (!chapter) throw new Error('No chapter selected');
  return `${chapter.title}\n\n${chapter.text}\n`;
}

export function resolveMbSuggestion(state: { hasFiles: boolean; hasError: boolean }): MbSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker MOBI sample',
      reason: 'Load a tiny handbook with Introduction, Shop floor TOC, and ShopRanker typography.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a MOBI book',
      reason: 'Drop a .mobi/.azw dump, JSON, or CSV — or load the sample handbook.',
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
