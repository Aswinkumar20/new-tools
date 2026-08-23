/** Shared data-explorer file helpers (kept local to avoid cross-lib coupling). */

export function dataBytesToBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function formatDataFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDataFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function getDataFileExtName(fileName: string): string {
  return getDataFileExtension(fileName).replace(/^\./, '');
}

/** Heading + pipe table dumps used as portable samples across explorers. */
export function looksLikeMarkdownDump(text: string, fileName = '', nativeExts: readonly string[] = []): boolean {
  const ext = getDataFileExtName(fileName);
  if (nativeExts.includes(ext)) return false;
  if (ext === 'md' || ext === 'markdown') return true;
  const t = text.trim();
  if (!/^#\s+\S/.test(t)) return false;
  return /(?:^|\n)[^\n|]*\|[^\n|]+/.test(t);
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

export function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
      else reject(new Error('Failed to read file as ArrayBuffer'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string, mime: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!bytes?.length) throw new Error('Nothing to download');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'download.bin';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!content) throw new Error('Nothing to download');
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.trim() || 'download.txt';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  if (typeof document === 'undefined') throw new Error('Download is only available in the browser');
  if (!dataUrl) throw new Error('Nothing to download');
  const anchor = document.createElement('a');
  anchor.href = urlSafe(dataUrl);
  anchor.download = fileName.trim() || 'snapshot.png';
  anchor.click();
}

function urlSafe(dataUrl: string): string {
  return dataUrl;
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export interface DataRecordEntry {
  key: string;
  value: string;
}

/** Compact label for a row/record using the first populated fields. */
export function previewRecordLabel(
  row: Record<string, unknown> | null | undefined,
  fallback = 'row',
  maxFields = 2
): string {
  if (!row) return fallback;
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(row)) {
    const value = raw == null ? '' : String(raw).trim();
    if (!value) continue;
    parts.push(`${key}=${value.length > 40 ? `${value.slice(0, 37)}…` : value}`);
    if (parts.length >= maxFields) break;
  }
  return parts.length ? parts.join(' · ') : fallback;
}

export function entriesFromRecord(row: Record<string, unknown> | null | undefined): DataRecordEntry[] {
  if (!row) return [];
  return Object.entries(row).map(([key, raw]) => ({
    key,
    value: raw == null ? '' : String(raw)
  }));
}

export interface DataInsightStats {
  files: number;
  groupLabel: string;
  groupCount: number;
  itemLabel: string;
  itemCount: number;
  sizeLabel: string;
  sizeValue: string;
  warningCount: number;
}

const GROUP_STAT_KEYS: ReadonlyArray<[string, string]> = [
  ['tables', 'Tables'],
  ['sections', 'Sections'],
  ['nodes', 'Nodes'],
  ['fields', 'Fields'],
  ['schema', 'Schema'],
  ['columns', 'Columns'],
  ['batches', 'Batches'],
  ['rowGroups', 'Row groups']
];

const ITEM_STAT_KEYS: ReadonlyArray<[string, string]> = [
  ['records', 'Records'],
  ['rows', 'Rows'],
  ['keys', 'Keys'],
  ['attributes', 'Attrs'],
  ['issues', 'Issues']
];

function countNamedArray(parsed: Record<string, unknown> | null | undefined, key: string): number {
  const value = parsed?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export function buildDataInsightStats(
  parsed: Record<string, unknown> | null | undefined,
  fileCount: number,
  currentSize: number | null,
  warnings: string[] | undefined,
  formatSize: (bytes: number) => string
): DataInsightStats {
  let groupLabel = 'Columns';
  let groupCount = 0;
  for (const [key, label] of GROUP_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      groupLabel = label;
      groupCount = count;
      break;
    }
  }
  let itemLabel = 'Rows';
  let itemCount = 0;
  for (const [key, label] of ITEM_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      itemLabel = label;
      itemCount = count;
      break;
    }
  }
  if (!itemCount && Array.isArray(parsed?.['tables'])) {
    itemCount = (parsed['tables'] as Array<{ rows?: unknown[]; numRows?: number }>).reduce(
      (sum, table) => sum + (Array.isArray(table.rows) ? table.rows.length : Number(table.numRows) || 0),
      0
    );
  }
  const warningCount = warnings?.length ?? 0;
  const sizeLabel = currentSize != null ? 'Size' : 'Warnings';
  const sizeValue = currentSize != null ? formatSize(currentSize) : String(warningCount);
  return {
    files: fileCount,
    groupLabel,
    groupCount,
    itemLabel,
    itemCount,
    sizeLabel,
    sizeValue,
    warningCount
  };
}
