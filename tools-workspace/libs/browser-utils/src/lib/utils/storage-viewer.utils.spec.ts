import type { StorageLike } from '../types/storage-viewer.types';
import {
  filterStorageEntries,
  formatStorageBytes,
  formatStorageTypeLabel,
  looksLikeJson,
  mapStorageEstimate,
  readStorageEntries,
  resolveStorageSuggestion,
  serializeAllStorageEntries,
  serializeStorageLine
} from './storage-viewer.utils';

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

describe('storage-viewer.utils', () => {
  it('reads, sorts, filters, and serializes entries', () => {
    const storage = new MemoryStorage();
    storage.setItem('beta', '2');
    storage.setItem('alpha', '1');

    const entries = readStorageEntries(storage);
    expect(entries.map((entry) => entry.key)).toEqual(['alpha', 'beta']);
    expect(entries[0].bytes).toBeGreaterThan(0);

    expect(filterStorageEntries(entries, 'alp')).toHaveLength(1);
    expect(filterStorageEntries(entries, '2')).toHaveLength(1);
    expect(filterStorageEntries(entries, '')).toHaveLength(2);

    expect(serializeStorageLine(entries[0])).toBe('alpha=1');
    expect(serializeAllStorageEntries(entries)).toBe('alpha=1\nbeta=2');
  });

  it('formats byte sizes and storage type labels', () => {
    expect(formatStorageBytes(null)).toBe('N/A');
    expect(formatStorageBytes(0)).toBe('0 B');
    expect(formatStorageBytes(1024)).toBe('1.00 KB');
    expect(formatStorageTypeLabel('local')).toBe('Local');
    expect(formatStorageTypeLabel('session')).toBe('Session');
  });

  it('maps storage estimates and detects JSON payloads', () => {
    expect(mapStorageEstimate({ usage: 10, quota: 100 })).toEqual({
      usedBytes: 10,
      quotaBytes: 100
    });
    expect(looksLikeJson('{"a":1}')).toBe(true);
    expect(looksLikeJson('[1,2]')).toBe(true);
    expect(looksLikeJson('{broken')).toBe(false);
    expect(looksLikeJson('plain')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';
    expect(resolveStorageSuggestion(jwt, 1, 'local')?.path).toBe('/testing-tools/jwt-decoder');

    expect(resolveStorageSuggestion('{"ok":true}', 1, 'local')?.path).toBe(
      '/data-converters/json-formatter-beautifier-validator'
    );

    expect(resolveStorageSuggestion('', 0, 'session')?.path).toBe('/browser-utils/cookie-editor');
    expect(resolveStorageSuggestion('', 3, 'local')?.path).toBe('/browser-utils/cookie-editor');
  });
});
