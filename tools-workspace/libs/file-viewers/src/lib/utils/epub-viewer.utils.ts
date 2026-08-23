import { EP_MAX_FILE_BYTES, EP_SUPPORTED_EXTENSIONS } from '../constants/epub-viewer.constants';
import type { EpChapter, EpDataset, EpLoadedFile, EpMetadataRow, EpSuggestion, EpTocEntry } from '../types/epub-viewer.types';
import { buildSampleEpBytes, parseEpBytes } from './epub-viewer-parse.utils';

export {
  buildSampleEpBytes,
  buildSampleEpJson,
  buildSampleEpZip,
  filterEpChapters,
  filterEpRows,
  filterEpToc,
  parseEpBytes,
  parseEpText
} from './epub-viewer-parse.utils';

export function formatEpFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getEpFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readEpFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedEpFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (EP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getEpFileExtension(file.name));
}

export function validateEpFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > EP_MAX_FILE_BYTES) return `File is too large (max ${formatEpFileSize(EP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidEpFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed EPUB files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedEpFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .epub, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateEpFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleEpFile(): File {
  return new File([buildSampleEpBytes() as BlobPart], 'sample-shop-ranker.epub', { type: 'application/epub+zip', lastModified: 0 });
}

export function createEpFileRecord(file: File, bytes: Uint8Array): EpLoadedFile {
  const extension = getEpFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: EpDataset | null = null;
  let softFail = false;
  try {
    parsed = parseEpBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.chapters.length && !parsed.toc.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse EPUB dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportEp(file: EpLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildEpMetadataRows(dataset: EpDataset): EpMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Creator', value: dataset.creator || '—' },
    { key: 'Language', value: dataset.language || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'EPUB', value: dataset.epubVer || '—' },
    { key: 'Chapters', value: String(dataset.chapterCount) },
    { key: 'TOC', value: String(dataset.tocCount) }
  ];
}

export function buildEpChapterMetadata(chapter: EpChapter): EpMetadataRow[] {
  return [
    { key: 'Name', value: chapter.name },
    { key: 'Title', value: chapter.title },
    { key: 'Href', value: chapter.href || '—' },
    { key: 'Words', value: String(chapter.wordCount) }
  ];
}

export function buildEpTocMetadata(entry: EpTocEntry): EpMetadataRow[] {
  return [
    { key: 'Label', value: entry.label },
    { key: 'Chapter', value: entry.chapter || '—' },
    { key: 'Href', value: entry.href || '—' }
  ];
}

export function exportEpSummaryJson(file: EpLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed EPUB dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      creator: parsed.creator,
      language: parsed.language,
      epubVer: parsed.epubVer,
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

export function exportEpSchemaCsv(dataset: EpDataset): string {
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

export function exportEpRowsCsv(dataset: EpDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function exportEpChapterTxt(chapter: EpChapter | null): string {
  if (!chapter) throw new Error('No chapter selected');
  return `${chapter.title}\n\n${chapter.text}\n`;
}

export function resolveEpSuggestion(state: { hasFiles: boolean; hasError: boolean }): EpSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker EPUB sample',
      reason: 'Load a tiny handbook with Introduction, Shop floor TOC, and ShopRanker typography.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an EPUB book',
      reason: 'Drop an .epub dump, store ZIP, JSON, or CSV — or load the sample handbook.',
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
