export const PDF_MAX_BYTES = 100 * 1024 * 1024;
/** Copied from node_modules/pdfjs-dist at build time — not a CDN URL. */
export const PDFJS_WORKER_SRC = 'assets/pdfjs/pdf.worker.min.js';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function isNonEmptyBytes(bytes: Uint8Array | null | undefined): bytes is Uint8Array {
  return !!bytes && bytes.length > 0;
}

/** Clone bytes so Blob/download is not affected by detached or reused buffers. */
export function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function scheduleRevokeObjectUrl(url: string): void {
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (!blob.size) {
    throw new Error('Cannot download empty file');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  scheduleRevokeObjectUrl(url);
}

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  if (!isNonEmptyBytes(bytes)) {
    throw new Error('Cannot download empty PDF');
  }
  const copy = cloneBytes(bytes);
  downloadBlob(new Blob([copy as BlobPart], { type: 'application/pdf' }), filename);
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  if (!text) {
    throw new Error('Cannot download empty file');
  }
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/** Parse "1-3,5,7" into 0-based page index sets */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const result = new Set<number>();
  for (const part of trimmed.split(',')) {
    const segment = part.trim();
    if (!segment) continue;
    if (segment.includes('-')) {
      const [startStr, endStr] = segment.split('-');
      const start = Math.max(1, Number.parseInt(startStr, 10));
      const end = Math.min(pageCount, Number.parseInt(endStr, 10));
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let p = start; p <= end; p++) result.add(p - 1);
    } else {
      const page = Number.parseInt(segment, 10);
      if (!Number.isNaN(page) && page >= 1 && page <= pageCount) result.add(page - 1);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function isPasswordError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('password') || lower.includes('encrypted') || lower.includes('decrypt');
}

export function defaultOutputName(originalName: string, suffix: string): string {
  const base = originalName.replace(/\.pdf$/i, '') || 'document';
  return `${base}-${suffix}.pdf`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
