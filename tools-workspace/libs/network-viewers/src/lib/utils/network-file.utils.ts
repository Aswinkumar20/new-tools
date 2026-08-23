/** Shared network-viewer file helpers (kept local to avoid cross-lib coupling). */

export function formatNetworkFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  const match = /(?:\.([^.]+))$/.exec(lower);
  return match?.[0] ?? '';
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
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
