import type { MinificationResult, MinifierHistoryEntry } from '../types/minifier.types';

export function buildMinificationResult(original: string, minified: string): MinificationResult {
  const originalSize = original.length;
  const minifiedSize = minified.length;
  const reduction = originalSize - minifiedSize;
  const reductionPercentage =
    originalSize > 0 ? Math.round((reduction / originalSize) * 100) : 0;

  return {
    minified,
    originalSize,
    minifiedSize,
    reduction,
    reductionPercentage
  };
}

export function prependMinifierHistory(
  entries: MinifierHistoryEntry[],
  entry: MinifierHistoryEntry,
  limit: number
): MinifierHistoryEntry[] {
  const exists = entries.some(
    (item) => item.minified === entry.minified && item.original === entry.original
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function createMinifierHistoryEntry(
  original: string,
  minified: string,
  reduction: number,
  timestamp = Date.now()
): MinifierHistoryEntry {
  return { timestamp, original, minified, reduction };
}

export function formatMinifierHistoryPreview(minified: string, maxLength = 60): string {
  if (minified.length <= maxLength) {
    return minified;
  }
  return `${minified.substring(0, maxLength)}…`;
}

export function looksLikeHtmlSource(text: string): boolean {
  const trimmed = text.trim();
  return (
    /<!DOCTYPE\s+html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed) ||
    /<\/?(div|span|body|head|script|style)[\s>]/i.test(trimmed)
  );
}

export function looksLikeJavaScriptSource(text: string): boolean {
  const trimmed = text.trim();
  if (looksLikeHtmlSource(trimmed)) {
    return false;
  }
  return (
    /\bfunction\s*\(/.test(trimmed) ||
    /\b(const|let|var)\s+\w+\s*=/.test(trimmed) ||
    /=>\s*\{/.test(trimmed) ||
    /\bconsole\.(log|debug|info|warn|error)\s*\(/.test(trimmed)
  );
}

export function looksLikeCssOnlySource(text: string): boolean {
  const trimmed = text.trim();
  if (/<\/?[a-zA-Z]/.test(trimmed) || /<!DOCTYPE/i.test(trimmed)) {
    return false;
  }
  return /\{[^}]*:[^}]*\}/.test(trimmed) && !looksLikeJavaScriptSource(trimmed);
}
