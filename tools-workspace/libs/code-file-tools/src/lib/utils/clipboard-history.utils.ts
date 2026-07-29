import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import { CLIPBOARD_HISTORY_PREVIEW_MAX_LENGTH } from '../constants/clipboard-history.constants';
import type {
  ClipboardEntry,
  ClipboardEntryType,
  ClipboardHistorySettings
} from '../types/clipboard-history.types';

export function isClipboardApiSupported(isBrowser: boolean): boolean {
  return (
    isBrowser &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.readText === 'function' &&
    typeof navigator.clipboard.writeText === 'function'
  );
}

export function createClipboardEntryId(now = Date.now(), random = Math.random()): string {
  return `${now}-${random.toString(36).slice(2, 11)}`;
}

export function getClipboardPreview(
  text: string,
  maxLength = CLIPBOARD_HISTORY_PREVIEW_MAX_LENGTH
): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}...`;
}

export function detectClipboardEntryType(text: string): ClipboardEntryType {
  if (/^https?:\/\/.+/.test(text.trim())) {
    return 'url';
  }
  if (
    /[{}();=]/.test(text) ||
    text.includes('function') ||
    text.includes('const ') ||
    text.includes('var ')
  ) {
    return 'code';
  }
  return 'text';
}

export function createClipboardEntry(
  text: string,
  options: { now?: number; random?: number; previewMaxLength?: number } = {}
): ClipboardEntry {
  const now = options.now ?? Date.now();
  return {
    id: createClipboardEntryId(now, options.random ?? Math.random()),
    text,
    timestamp: now,
    preview: getClipboardPreview(text, options.previewMaxLength),
    length: text.length,
    type: detectClipboardEntryType(text)
  };
}

export function canAddClipboardText(
  text: string,
  history: ClipboardEntry[],
  settings: Pick<ClipboardHistorySettings, 'minLength' | 'maxLength' | 'excludeDuplicates'>
): boolean {
  if (text.length < settings.minLength || text.length > settings.maxLength) {
    return false;
  }
  if (settings.excludeDuplicates && history.some((entry) => entry.text === text)) {
    return false;
  }
  return true;
}

export function prependClipboardEntry(
  history: ClipboardEntry[],
  entry: ClipboardEntry,
  maxEntries: number
): ClipboardEntry[] {
  return [entry, ...history].slice(0, maxEntries);
}

export function promoteClipboardEntry(
  history: ClipboardEntry[],
  entry: ClipboardEntry,
  timestamp = Date.now()
): ClipboardEntry[] {
  const filtered = history.filter((item) => item.id !== entry.id);
  return [{ ...entry, timestamp }, ...filtered];
}

export function filterClipboardHistory(entries: ClipboardEntry[], query: string): ClipboardEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      entry.text.toLowerCase().includes(normalizedQuery) ||
      entry.preview.toLowerCase().includes(normalizedQuery)
  );
}

export function formatClipboardTimestamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString();
}

export function formatClipboardBytes(value: number): string {
  if (value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / Math.pow(1024, exponent);
  return `${scaled.toFixed(scaled >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function parseClipboardHistory(raw: string | null): ClipboardEntry[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as ClipboardEntry[];
  return Array.isArray(parsed) ? parsed : [];
}

export function parseClipboardSettings(
  raw: string | null,
  defaults: ClipboardHistorySettings
): Partial<ClipboardHistorySettings> {
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as Partial<ClipboardHistorySettings>;
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function looksLikeJsonClip(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return false;
  }
  const isObject = trimmed.startsWith('{') && trimmed.endsWith('}');
  const isArray = trimmed.startsWith('[') && trimmed.endsWith(']');
  if (!isObject && !isArray) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function resolveClipboardHistorySuggestion(
  isSupported: boolean,
  entryCount: number,
  selected: ClipboardEntry | null
): CftToolSuggestion | null {
  if (!isSupported) {
    return {
      id: 'unsupported-clipboard',
      title: 'Clipboard API not available here',
      reason:
        'This browser blocked clipboard access. Open Clipboard Viewer on a secure (HTTPS) context or grant permission, then retry.',
      actionLabel: 'Open Clipboard Viewer',
      path: '/code-file-tools/clipboard-viewer'
    };
  }

  if (selected?.type === 'url') {
    return {
      id: 'url-clip',
      title: 'Selected clip looks like a URL',
      reason:
        'Encode or decode query strings and path segments before pasting this link into another tool.',
      actionLabel: 'Open URL Encode / Decode',
      path: '/text-utilities/url-encode-and-decode'
    };
  }

  if (selected && looksLikeJsonClip(selected.text)) {
    return {
      id: 'json-clip',
      title: 'Selected clip looks like JSON',
      reason:
        'Pretty-print and validate this payload in JSON Formatter before editing or comparing it.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (selected?.type === 'code') {
    return {
      id: 'code-clip',
      title: 'Selected clip looks like code',
      reason:
        'Compare this snippet against another version with Text Difference, or minify it in the JS minifier.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  if (entryCount === 0) {
    return {
      id: 'empty-history',
      title: 'No clipboard history yet',
      reason:
        'Enable auto-monitor or add a clip. Clipboard Viewer can also show live clipboard metadata while you build history.',
      actionLabel: 'Open Clipboard Viewer',
      path: '/code-file-tools/clipboard-viewer'
    };
  }

  return {
    id: 'pair-viewer',
    title: 'Pair with live clipboard viewing',
    reason:
      'History captures past clips. Use Clipboard Viewer for live content, type detection, and metadata.',
    actionLabel: 'Open Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer'
  };
}
