import { OD_MAX_FILE_BYTES, OD_SUPPORTED_EXTENSIONS } from '../constants/opendocument-viewer.constants';
import type { OdBlock, OdCell, OdDataset, OdLoadedFile, OdMetadataRow, OdPage, OdSheet, OdSuggestion } from '../types/opendocument-viewer.types';
import { buildSampleOdBytes, parseOdBytes } from './opendocument-viewer-parse.utils';

export {
  buildSampleOdBytes,
  buildSampleOdJson,
  filterOdBlocks,
  filterOdCells,
  filterOdPages,
  filterOdRows,
  filterOdSheets,
  parseOdBytes,
  parseOdText
} from './opendocument-viewer-parse.utils';

export function formatOdFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getOdFileExtension(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? `.${m[1]}` : '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readOdFileBytes(file: File): Promise<Uint8Array> {
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

export function isSupportedOdFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (OD_SUPPORTED_EXTENSIONS as readonly string[]).includes(getOdFileExtension(file.name));
}

export function validateOdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > OD_MAX_FILE_BYTES) return `File is too large (max ${formatOdFileSize(OD_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidOdFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed OpenDocument files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedOdFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .odt, .ods, .odp, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateOdFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleOdFile(): File {
  return new File([buildSampleOdBytes() as BlobPart], 'sample-shop-ranker.odt', {
    type: 'application/vnd.oasis.opendocument.text',
    lastModified: 0
  });
}

export function createOdFileRecord(file: File, bytes: Uint8Array): OdLoadedFile {
  const extension = getOdFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: OdDataset | null = null;
  let softFail = false;
  try {
    parsed = parseOdBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.pages.length && !parsed.sheets.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse ODF dump');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportOd(file: OdLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildOdMetadataRows(dataset: OdDataset): OdMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Author', value: dataset.author || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'ODF', value: dataset.odfVer || '—' },
    { key: 'Kind', value: dataset.kind || '—' },
    { key: 'Pages', value: String(dataset.pageCount) },
    { key: 'Sheets', value: String(dataset.sheetCount) }
  ];
}

export function buildOdPageMetadata(page: OdPage): OdMetadataRow[] {
  return [
    { key: 'Name', value: page.name },
    { key: 'Kind', value: page.kind }
  ];
}

export function buildOdSheetMetadata(sheet: OdSheet): OdMetadataRow[] {
  return [
    { key: 'Name', value: sheet.name },
    { key: 'Kind', value: sheet.kind }
  ];
}

export function buildOdBlockMetadata(block: OdBlock): OdMetadataRow[] {
  return [
    { key: 'Name', value: block.name },
    { key: 'Kind', value: block.kind },
    { key: 'Page', value: block.page || '—' },
    { key: 'Text', value: block.text || '—' }
  ];
}

export function buildOdCellMetadata(cell: OdCell): OdMetadataRow[] {
  return [
    { key: 'Ref', value: cell.ref },
    { key: 'Sheet', value: cell.sheet },
    { key: 'Value', value: cell.value || '—' }
  ];
}

export function exportOdSummaryJson(file: OdLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ODF dump');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      author: parsed.author,
      odfVer: parsed.odfVer,
      kind: parsed.kind,
      pages: parsed.pages.map((p) => ({ name: p.name, kind: p.kind })),
      sheets: parsed.sheets.map((s) => ({ name: s.name, kind: s.kind })),
      blocks: parsed.blocks.map((b) => ({ name: b.name, kind: b.kind, page: b.page, text: b.text })),
      cells: parsed.cells.map((c) => ({ sheet: c.sheet, ref: c.ref, value: c.value })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportOdSchemaCsv(dataset: OdDataset): string {
  const lines = ['kind,name,type,page,sheet,value'];
  for (const p of dataset.pages) lines.push(['page', csv(p.name), csv(p.kind), csv(p.name), '', ''].join(','));
  for (const s of dataset.sheets) lines.push(['sheet', csv(s.name), csv(s.kind), '', csv(s.name), ''].join(','));
  for (const b of dataset.blocks) lines.push(['block', csv(b.name), csv(b.kind), csv(b.page), '', csv(b.text)].join(','));
  for (const c of dataset.cells) lines.push(['cell', csv(c.ref), 'cell', '', csv(c.sheet), csv(c.value)].join(','));
  return lines.join('\n');
}

export function exportOdRowsCsv(dataset: OdDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) lines.push(header.map((h) => csv(row[h] || '')).join(','));
  return lines.join('\n');
}

export function resolveOdSuggestion(state: { hasFiles: boolean; hasError: boolean }): OdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker ODF sample',
      reason: 'Load a tiny ODT dump with cover/notes pages, an inventory sheet, and ShopRanker text.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an OpenDocument file',
      reason: 'Drop a .odt / .ods / .odp dump, JSON, or CSV — or load the sample handbook.',
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
