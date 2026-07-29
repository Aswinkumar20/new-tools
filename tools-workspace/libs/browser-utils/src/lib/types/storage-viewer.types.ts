export type StorageType = 'local' | 'session';

export interface StorageEntry {
  key: string;
  value: string;
  bytes: number;
}

export interface StorageInfo {
  usedBytes: number | null;
  quotaBytes: number | null;
}

/** Minimal Storage-like surface for pure unit tests. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
