/** Lightweight text normalization for client-side tool search. */

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'of',
  'and',
  'or',
  'in',
  'on',
  'my',
  'me',
  'i',
  'is',
  'are',
  'was',
  'were',
  'be',
  'this',
  'that',
  'it',
  'from',
  'with',
  'into',
  'as',
  'at',
  'by',
  'do',
  'how',
  'can',
  'need',
  'want',
  'please',
  'help',
  'some',
  'any',
  'file',
  'files',
  'tool',
  'tools',
]);

export function normalizeText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[↔→←]/g, ' to ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string, { keepStopWords = false } = {}): string[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .filter((token) => keepStopWords || !STOP_WORDS.has(token));
}

export function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function clampQuery(query: string, maxLength = 200): string {
  return query.trim().slice(0, maxLength);
}

export function pathToToolId(path: string): string {
  return path.replace(/^\/+/, '').replace(/\//g, '__');
}
