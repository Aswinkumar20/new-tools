import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import { STORAGE_BYTE_UNITS } from '../constants/storage-viewer.constants';
import { looksLikeBase64, looksLikeJwt } from './cookie-editor.utils';
import type {
  StorageEntry,
  StorageInfo,
  StorageLike,
  StorageType
} from '../types/storage-viewer.types';

export function estimateEntryBytes(value: string): number {
  return new Blob([value]).size;
}

export function readStorageEntries(storage: StorageLike): StorageEntry[] {
  const entries: StorageEntry[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null) continue;
    const value = storage.getItem(key) ?? '';
    entries.push({ key, value, bytes: estimateEntryBytes(value) });
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export function filterStorageEntries(entries: StorageEntry[], query: string): StorageEntry[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      entry.key.toLowerCase().includes(normalizedQuery) ||
      entry.value.toLowerCase().includes(normalizedQuery)
  );
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null) return 'N/A';
  if (bytes === 0) return '0 B';
  const base = 1024;
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  return `${(bytes / Math.pow(base, unitIndex)).toFixed(2)} ${STORAGE_BYTE_UNITS[unitIndex]}`;
}

export function serializeStorageLine(entry: StorageEntry): string {
  return `${entry.key}=${entry.value}`;
}

export function serializeAllStorageEntries(entries: StorageEntry[]): string {
  return entries.map((entry) => serializeStorageLine(entry)).join('\n');
}

export function formatStorageTypeLabel(storageType: StorageType): string {
  return storageType === 'local' ? 'Local' : 'Session';
}

export function mapStorageEstimate(estimate: {
  usage?: number;
  quota?: number;
}): StorageInfo {
  return {
    usedBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null
  };
}

export function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
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

export function resolveStorageSuggestion(
  editorValue: string,
  entryCount: number,
  storageType: StorageType
): BuToolSuggestion | null {
  if (looksLikeJwt(editorValue)) {
    return {
      id: 'jwt-storage-value',
      title: 'Storage value looks like a JWT',
      reason:
        'This value appears to be a three-part token. Decode it in JWT Decoder to inspect claims without leaving EasyToolHub.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  if (looksLikeBase64(editorValue) && !looksLikeJwt(editorValue)) {
    return {
      id: 'base64-storage-value',
      title: 'Storage value looks Base64 encoded',
      reason:
        'Decode the payload first if you need to inspect structured data stored under this key.',
      actionLabel: 'Open Base64 Encode / Decode',
      path: '/text-utilities/base64-encode-and-decode'
    };
  }

  if (looksLikeJson(editorValue)) {
    return {
      id: 'json-storage-value',
      title: 'Storage value looks like JSON',
      reason:
        'Pretty-print and validate this payload in JSON Formatter before editing it back into Web Storage.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (entryCount === 0) {
    return {
      id: 'empty-try-cookies',
      title: `No ${storageType === 'local' ? 'localStorage' : 'sessionStorage'} entries yet`,
      reason:
        'If the app stores state in cookies instead, Cookie Editor can inspect document cookies next.',
      actionLabel: 'Open Cookie Editor',
      path: '/browser-utils/cookie-editor'
    };
  }

  return {
    id: 'pair-with-cookies',
    title: 'Continue client-state inspection',
    reason:
      'Web Storage is only part of browser state. Pair this viewer with Cookie Editor for a full local persistence check.',
    actionLabel: 'Open Cookie Editor',
    path: '/browser-utils/cookie-editor'
  };
}
