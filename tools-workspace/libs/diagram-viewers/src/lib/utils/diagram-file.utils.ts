/** Shared diagram-viewer file + insight helpers (kept local to avoid cross-lib coupling). */

export function diagramBytesToBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function formatDiagramFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getDiagramFileExtension(fileName: string): string {
  const match = /(?:\.([^.]+))$/.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

export function getDiagramFileExtName(fileName: string): string {
  return getDiagramFileExtension(fileName).replace(/^\./, '');
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
  anchor.href = dataUrl;
  anchor.download = fileName.trim() || 'snapshot.png';
  anchor.click();
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export interface DiagramInsightStats {
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
  ['boxes', 'Boxes'],
  ['elements', 'Elements'],
  ['classes', 'Classes'],
  ['tables', 'Tables'],
  ['models', 'Models'],
  ['states', 'States'],
  ['rules', 'Rules'],
  ['workloads', 'Workloads'],
  ['resources', 'Resources'],
  ['shapes', 'Shapes'],
  ['pages', 'Pages'],
  ['entities', 'Entities'],
  ['packages', 'Packages'],
  ['concepts', 'Concepts'],
  ['topics', 'Topics'],
  ['branches', 'Branches'],
  ['nodes', 'Nodes']
];

const ITEM_STAT_KEYS: ReadonlyArray<[string, string]> = [
  ['connectors', 'Connectors'],
  ['transitions', 'Transitions'],
  ['triples', 'Triples'],
  ['relations', 'Relations'],
  ['refs', 'Refs'],
  ['fks', 'FKs'],
  ['conditions', 'Conditions'],
  ['links', 'Links'],
  ['axioms', 'Axioms'],
  ['properties', 'Props'],
  ['services', 'Services'],
  ['cycles', 'Cycles'],
  ['icons', 'Icons'],
  ['edges', 'Edges']
];

function countNamedArray(parsed: Record<string, unknown> | null | undefined, key: string): number {
  const value = parsed?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export function buildDiagramInsightStats(
  parsed: Record<string, unknown> | null | undefined,
  fileCount: number,
  currentSize: number | null,
  warnings: string[] | undefined,
  formatSize: (bytes: number) => string
): DiagramInsightStats {
  let groupLabel = 'Nodes';
  let groupCount = 0;
  for (const [key, label] of GROUP_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      groupLabel = label;
      groupCount = count;
      break;
    }
  }

  let itemLabel = 'Edges';
  let itemCount = 0;
  for (const [key, label] of ITEM_STAT_KEYS) {
    const count = countNamedArray(parsed, key);
    if (count > 0 || (parsed && Array.isArray(parsed[key]))) {
      itemLabel = label;
      itemCount = count;
      break;
    }
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
