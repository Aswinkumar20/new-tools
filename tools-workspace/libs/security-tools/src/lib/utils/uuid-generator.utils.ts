import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import {
  UUID_GENERATOR_HISTORY_LIMIT,
  UUID_GENERATOR_MAX_COUNT,
  UUID_GENERATOR_MIN_COUNT
} from '../constants/uuid-generator.constants';
import type {
  UuidEntry,
  UuidGenerateResult,
  UuidGeneratorFormValues,
  UuidSuggestionContext
} from '../types/uuid-generator.types';

export function createUuidV4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

export function formatUuidValue(
  uuid: string,
  options: Pick<UuidGeneratorFormValues, 'uppercase' | 'withBraces' | 'withHyphens'>
): string {
  let value = uuid;

  if (!options.withHyphens) {
    value = value.replace(/-/g, '');
  }
  if (options.uppercase) {
    value = value.toUpperCase();
  }
  if (options.withBraces) {
    value = `{${value}}`;
  }

  return value;
}

export function validateUuidGenerateCount(count: number): string[] {
  if (count < UUID_GENERATOR_MIN_COUNT || count > UUID_GENERATOR_MAX_COUNT) {
    return ['Count must be between 1 and 50.'];
  }
  return [];
}

export function generateUuidEntries(options: UuidGeneratorFormValues): UuidGenerateResult {
  const errors = validateUuidGenerateCount(options.count);
  if (errors.length) {
    return { entries: [], errors };
  }

  const entries: UuidEntry[] = [];
  for (let i = 0; i < options.count; i++) {
    entries.push({
      value: formatUuidValue(createUuidV4(), options),
      createdAt: Date.now()
    });
  }

  return { entries, errors: [] };
}

export function mergeUuidHistory(
  nextEntries: UuidEntry[],
  existing: UuidEntry[],
  limit: number = UUID_GENERATOR_HISTORY_LIMIT
): UuidEntry[] {
  return [...nextEntries, ...existing].slice(0, limit);
}

export function resolveUuidFormatLabel(
  options: Pick<UuidGeneratorFormValues, 'uppercase' | 'withBraces' | 'withHyphens'>
): string {
  const parts: string[] = [];
  if (options.withHyphens) parts.push('hyphen');
  if (options.uppercase) parts.push('upper');
  if (options.withBraces) parts.push('brace');
  return parts.length ? parts.join('+') : 'plain';
}

export function shortenUuidDisplay(uuid: string): string {
  if (!uuid) {
    return '—';
  }
  return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
}

export function joinUuidValues(entries: UuidEntry[]): string {
  return entries.map((entry) => entry.value).join('\n');
}

export function resolveUuidSuggestion(context: UuidSuggestionContext): StToolSuggestion | null {
  const { hasUuids, uuidCount, batchCount, withHyphens, errorMessage } = context;

  if (errorMessage?.includes('Count must')) {
    return {
      id: 'uuid-count-range',
      title: 'Count is out of range',
      reason: 'Generate between 1 and 50 UUIDs per batch. The session list keeps the newest 100.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  if (!hasUuids) {
    return {
      id: 'uuid-get-started',
      title: 'Need unique IDs?',
      reason:
        'Set count and formatting in Options, then Generate. Uses crypto.randomUUID when available (RFC 4122 v4).',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (!withHyphens) {
    return {
      id: 'uuid-compact',
      title: 'Compact UUIDs enabled',
      reason:
        'Hyphens are removed for denser IDs. Re-enable Include hyphens for the standard 8-4-4-4-12 form.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  if (batchCount > 1 || uuidCount > 1) {
    return {
      id: 'uuid-batch',
      title: 'Batch of UUIDs ready',
      reason:
        'Copy all for bulk use, or hash a related payload in Hash Generator when you need a checksum instead of a random ID.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  return {
    id: 'uuid-secure-copy',
    title: 'Moving an ID into a sensitive flow?',
    reason:
      'Secure Clipboard can copy text with an auto-expiring encrypted memory store after you paste elsewhere.',
    actionLabel: 'Open Secure Clipboard',
    path: '/security-tools/secure-clipboard'
  };
}
