import { LX_MAX_FILE_BYTES, LX_SUPPORTED_EXTENSIONS } from '../constants/latex-viewer.constants';
import type { LxCommand, LxDataset, LxEnv, LxLoadedFile, LxMetadataRow, LxSection, LxSuggestion } from '../types/latex-viewer.types';
import { buildSampleLxBytes, parseLxBytes } from './latex-viewer-parse.utils';

export {
  buildSampleLxBytes,
  buildSampleLxJson,
  filterLxCommands,
  filterLxEnvs,
  filterLxRows,
  filterLxSections,
  parseLxBytes,
  parseLxText
} from './latex-viewer-parse.utils';

export function formatLxFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getLxFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readLxFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedLxFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (LX_SUPPORTED_EXTENSIONS as readonly string[]).includes(getLxFileExtension(file.name));
}

export function validateLxFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > LX_MAX_FILE_BYTES) return `File is too large (max ${formatLxFileSize(LX_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidLxFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed LaTeX files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedLxFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .tex, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateLxFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleLxFile(): File {
  return new File([buildSampleLxBytes() as BlobPart], 'sample-shop-ranker.tex', { type: 'application/x-tex', lastModified: 0 });
}

export function createLxFileRecord(file: File, bytes: Uint8Array): LxLoadedFile {
  const extension = getLxFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: LxDataset | null = null;
  let softFail = false;
  try {
    parsed = parseLxBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.sections.length && !parsed.commands.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse LaTeX dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportLx(file: LxLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildLxMetadataRows(dataset: LxDataset): LxMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Author', value: dataset.author || '—' },
    { key: 'Class', value: dataset.docClass || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'LaTeX', value: dataset.latexVer || '—' },
    { key: 'Sections', value: String(dataset.sectionCount) },
    { key: 'Commands', value: String(dataset.commandCount) },
    { key: 'Envs', value: String(dataset.envCount) }
  ];
}

export function buildLxSectionMetadata(section: LxSection): LxMetadataRow[] {
  return [
    { key: 'Name', value: section.name },
    { key: 'Title', value: section.title },
    { key: 'Level', value: String(section.level) },
    { key: 'Text', value: section.text.slice(0, 120) || '—' }
  ];
}

export function buildLxCommandMetadata(command: LxCommand): LxMetadataRow[] {
  return [
    { key: 'Name', value: command.name },
    { key: 'Value', value: command.value || '—' }
  ];
}

export function buildLxEnvMetadata(env: LxEnv): LxMetadataRow[] {
  return [
    { key: 'Name', value: env.name },
    { key: 'Kind', value: env.kind },
    { key: 'Body', value: env.body || '—' }
  ];
}

export function exportLxSummaryJson(file: LxLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed LaTeX dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      author: parsed.author,
      docClass: parsed.docClass,
      latexVer: parsed.latexVer,
      sections: parsed.sections.map((s) => ({ name: s.name, title: s.title, level: s.level, text: s.text })),
      commands: parsed.commands.map((c) => ({ name: c.name, value: c.value })),
      envs: parsed.envs.map((e) => ({ name: e.name, kind: e.kind, body: e.body })),
      sourceText: parsed.sourceText,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportLxSchemaCsv(dataset: LxDataset): string {
  const lines = ['kind,name,type,section,command,value'];
  for (const s of dataset.sections) {
    lines.push(['section', csv(s.name), csv(String(s.level)), csv(s.title), '', csv(s.text.slice(0, 80))].join(','));
  }
  for (const c of dataset.commands) {
    lines.push(['command', csv(c.name), 'command', '', csv(c.name), csv(c.value)].join(','));
  }
  for (const e of dataset.envs) {
    lines.push(['env', csv(e.name), csv(e.kind), csv(e.name), csv(e.kind), csv(e.body)].join(','));
  }
  return lines.join('\n');
}

export function exportLxRowsCsv(dataset: LxDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function exportLxSourceTex(dataset: LxDataset): string {
  return dataset.sourceText || '';
}

export function resolveLxSuggestion(state: { hasFiles: boolean; hasError: boolean }): LxSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker LaTeX sample',
      reason: 'Load a tiny article with Introduction, Shop floor, graphicx, and a figure/equation.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a LaTeX file',
      reason: 'Drop a .tex dump, JSON, or CSV — or load the sample handbook.',
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
