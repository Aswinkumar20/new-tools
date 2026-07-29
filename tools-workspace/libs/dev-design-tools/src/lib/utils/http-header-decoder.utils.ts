import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  ENTITY_HEADER_KEYS,
  GENERAL_HEADER_KEYS,
  HEADER_CATEGORY_COLORS,
  HEADER_CATEGORY_LABELS,
  HTTP_HEADER_DESCRIPTIONS,
  HTTP_HEADER_HISTORY_LIMIT,
  REQUEST_HEADER_KEYS,
  RESPONSE_HEADER_KEYS
} from '../constants/http-header-decoder.constants';
import type {
  DecodedHeader,
  HeaderCategory,
  HeaderHistoryEntry,
  HeaderInputMode,
  HeaderParseResult
} from '../types/http-header-decoder.types';

export function categorizeHeaderKey(lowerKey: string): HeaderCategory {
  if (lowerKey.startsWith('access-control-')) {
    return 'cors';
  }
  if ((ENTITY_HEADER_KEYS as readonly string[]).includes(lowerKey)) {
    return 'entity';
  }
  if ((REQUEST_HEADER_KEYS as readonly string[]).includes(lowerKey)) {
    return 'request';
  }
  if ((RESPONSE_HEADER_KEYS as readonly string[]).includes(lowerKey)) {
    return 'response';
  }
  if ((GENERAL_HEADER_KEYS as readonly string[]).includes(lowerKey)) {
    return 'general';
  }
  return 'custom';
}

export function createDecodedHeader(key: string, value: string): DecodedHeader {
  const lowerKey = key.toLowerCase();
  return {
    key,
    value,
    description: HTTP_HEADER_DESCRIPTIONS[lowerKey],
    category: categorizeHeaderKey(lowerKey)
  };
}

export function parseRawHeaders(raw: string): HeaderParseResult {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);
  const headers: DecodedHeader[] = [];
  let skipped = 0;

  for (const line of lines) {
    if (/^HTTP\/\d/i.test(line)) {
      headers.push(createDecodedHeader('Status-Line', line));
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      skipped += 1;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key) {
      headers.push(createDecodedHeader(key, value));
    }
  }

  const warnings = skipped > 0 ? [`${skipped} line(s) ignored (missing ':').`] : [];
  return { headers, warnings };
}

export function parseKeyValueHeaders(input: string): HeaderParseResult {
  try {
    const json = JSON.parse(input);
    const headers: DecodedHeader[] = [];

    for (const [key, value] of Object.entries(json)) {
      headers.push(createDecodedHeader(key, value == null ? '' : String(value)));
    }

    return { headers, warnings: [] };
  } catch {
    const fallback = parseRawHeaders(input);
    // Match legacy behavior: raw skip warnings overwrite the JSON note when present.
    return {
      headers: fallback.headers,
      warnings:
        fallback.warnings.length > 0
          ? fallback.warnings
          : ['Input was not valid JSON — parsed as raw headers instead.']
    };
  }
}

export function decodeHttpHeaders(rawHeaders: string, inputMode: HeaderInputMode): HeaderParseResult {
  if (!rawHeaders.trim()) {
    return { headers: [], warnings: [] };
  }
  return inputMode === 'raw' ? parseRawHeaders(rawHeaders) : parseKeyValueHeaders(rawHeaders);
}

export function exportHeadersAsJson(headers: ReadonlyArray<DecodedHeader>): string {
  const json: Record<string, string> = {};
  for (const header of headers) {
    json[header.key] = header.value;
  }
  return JSON.stringify(json, null, 2);
}

export function exportHeadersAsRaw(headers: ReadonlyArray<DecodedHeader>): string {
  return headers.map((h) => `${h.key}: ${h.value}`).join('\n');
}

export function getHeaderCategories(headers: ReadonlyArray<DecodedHeader>): HeaderCategory[] {
  const categories = new Set<HeaderCategory>();
  for (const header of headers) {
    categories.add(header.category);
  }
  return Array.from(categories);
}

export function getHeadersByCategory(
  headers: ReadonlyArray<DecodedHeader>,
  category: HeaderCategory
): DecodedHeader[] {
  return headers.filter((h) => h.category === category);
}

export function getCategoryLabel(category: HeaderCategory): string {
  return HEADER_CATEGORY_LABELS[category];
}

export function getCategoryColor(category: HeaderCategory): string {
  return HEADER_CATEGORY_COLORS[category];
}

export function formatRelativeTimestamp(timestamp: number, now = Date.now()): string {
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

export function prependHeaderHistory(
  entries: HeaderHistoryEntry[],
  entry: HeaderHistoryEntry,
  limit = HTTP_HEADER_HISTORY_LIMIT
): HeaderHistoryEntry[] {
  const exists = entries.some((existing) => existing.rawInput === entry.rawInput);
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function resolveHttpHeaderSuggestion(
  headers: ReadonlyArray<DecodedHeader>
): DdToolSuggestion | null {
  if (headers.length === 0) {
    return null;
  }

  if (headers.some((header) => header.category === 'cors')) {
    return {
      id: 'hhd-cors',
      title: 'Verify these CORS headers live?',
      reason: 'Access-Control headers were detected. CORS Test Tool can confirm how the browser applies them.',
      actionLabel: 'Open CORS Test Tool',
      path: '/dev-design-tools/cors-test-tool'
    };
  }

  const auth = headers.find((header) => header.key.toLowerCase() === 'authorization');
  if (auth && /bearer\s+\S+/i.test(auth.value)) {
    return {
      id: 'hhd-jwt',
      title: 'Decode the Bearer token?',
      reason: 'Authorization looks like a JWT. Inspect claims locally before reusing the header set.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  const userAgent = headers.find((header) => header.key.toLowerCase() === 'user-agent');
  if (userAgent) {
    return {
      id: 'hhd-ua',
      title: 'Parse this User-Agent string?',
      reason: 'Break the client string into browser, OS, and device details for QA notes.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  const contentType = headers.find((header) => header.key.toLowerCase() === 'content-type');
  if (contentType && /json/i.test(contentType.value)) {
    return {
      id: 'hhd-json',
      title: 'Format a JSON payload next?',
      reason: 'Content-Type indicates JSON. Pretty-print a sample body with the formatter.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (headers.length > 0) {
    return {
      id: 'hhd-http',
      title: 'Build a request from these headers?',
      reason: 'HTTP Request Generator can turn this decoded set into a reusable client snippet.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  return null;
}
