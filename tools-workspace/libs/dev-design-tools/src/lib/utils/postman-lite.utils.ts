import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import {
  POSTMAN_HISTORY_LIMIT,
  POSTMAN_SAVED_LIMIT,
  POSTMAN_SAVED_STORAGE_KEY
} from '../constants/postman-lite.constants';
import type {
  PostmanHeaderPair,
  PostmanHistoryEntry,
  PostmanRequestInput,
  PostmanRequestResult,
  PostmanSavedRequest
} from '../types/postman-lite.types';

export function buildHttpHeaders(headers: ReadonlyArray<PostmanHeaderPair>): Record<string, string> {
  const httpHeaders: Record<string, string> = {};
  for (const header of headers) {
    if (header.key && header.value) {
      httpHeaders[header.key] = header.value;
    }
  }
  return httpHeaders;
}

export function findContentType(headers: Record<string, string>): string {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
}

/** Soft-validate JSON body when Content-Type claims JSON. Returns an error message or null. */
export function validateJsonBodyIfNeeded(
  headers: ReadonlyArray<PostmanHeaderPair>,
  body: string
): string | null {
  if (!body) {
    return null;
  }
  const contentType = findContentType(buildHttpHeaders(headers));
  if (!contentType.includes('json')) {
    return null;
  }
  try {
    JSON.parse(body);
    return null;
  } catch {
    return 'Request body is not valid JSON.';
  }
}

export function extractResponseHeaders(response: Response): Record<string, string> {
  const allHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });
  return allHeaders;
}

export function headersToList(headers: Record<string, string>): PostmanHeaderPair[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

export function hasHeaderEntries(headers: Record<string, string>): boolean {
  return Object.keys(headers).length > 0;
}

export function tryParseJson(text: string | null): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function formatJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  if (typeof obj === 'string') {
    return obj;
  }
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function looksLikeJsonBody(body: string | null): boolean {
  if (!body) {
    return false;
  }
  const trimmed = body.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function isLikelyCorsBrowserError(message: string): boolean {
  return (
    message.includes('CORS') ||
    message.includes('Access-Control') ||
    /Failed to fetch/i.test(message) ||
    /NetworkError/i.test(message)
  );
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

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function prependPostmanHistory(
  entries: PostmanHistoryEntry[],
  entry: PostmanHistoryEntry,
  limit = POSTMAN_HISTORY_LIMIT
): PostmanHistoryEntry[] {
  const exists = entries.some(
    (existing) =>
      existing.url === entry.url &&
      existing.method === entry.method &&
      existing.timestamp === entry.timestamp
  );
  if (exists) {
    return entries;
  }
  return [entry, ...entries].slice(0, limit);
}

export function prependSavedRequest(
  requests: PostmanSavedRequest[],
  request: PostmanSavedRequest,
  limit = POSTMAN_SAVED_LIMIT
): PostmanSavedRequest[] {
  const exists = requests.find((existing) => existing.id === request.id);
  if (exists) {
    return requests.map((existing) => (existing.id === request.id ? request : existing));
  }
  return [request, ...requests].slice(0, limit);
}

export function resolveSavedRequestName(name: string, now = Date.now()): string {
  const trimmed = name.trim();
  return trimmed || `Request ${now}`;
}

export function loadSavedRequestsFromStorage(
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null
): PostmanSavedRequest[] {
  if (!storage) {
    return [];
  }
  try {
    const stored = storage.getItem(POSTMAN_SAVED_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as PostmanSavedRequest[];
  } catch {
    return [];
  }
}

export function persistSavedRequests(
  requests: ReadonlyArray<PostmanSavedRequest>,
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(POSTMAN_SAVED_STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // Ignore localStorage quota / privacy mode errors
  }
}

export async function readResponseBody(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }
    return await response.text();
  } catch {
    return null;
  }
}

export async function executePostmanRequest(input: PostmanRequestInput): Promise<PostmanRequestResult> {
  const { url, method, headers, body } = input;
  const startTime = Date.now();
  const httpHeaders = buildHttpHeaders(headers);

  const fetchOptions: RequestInit = {
    method,
    headers: httpHeaders,
    mode: 'cors',
    cache: 'no-cache'
  };

  if (body && !['GET', 'HEAD'].includes(method)) {
    fetchOptions.body = body;
  }

  try {
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;
    const allHeaders = extractResponseHeaders(response);
    const responseBody = await readResponseBody(response);

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: allHeaders,
      body: responseBody,
      error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
      timestamp: Date.now(),
      duration
    };
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      success: false,
      status: null,
      statusText: '',
      headers: {},
      body: null,
      error: errorMessage,
      timestamp: Date.now(),
      duration
    };
  }
}

export function resolvePostmanSuggestion(options: {
  result: PostmanRequestResult | null;
  requestHeaders: ReadonlyArray<PostmanHeaderPair>;
  requestBody: string;
  jsonBodyError: boolean;
}): DdToolSuggestion | null {
  const { result, requestHeaders, requestBody, jsonBodyError } = options;

  if (jsonBodyError) {
    return {
      id: 'pl-json-body',
      title: 'Fix the JSON body first?',
      reason: 'Content-Type claims JSON but the body failed to parse. Validate and beautify it before sending again.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (!result) {
    return null;
  }

  const errorText = result.error ?? '';
  if (!result.success && result.status === null && isLikelyCorsBrowserError(errorText)) {
    return {
      id: 'pl-cors',
      title: 'Looks like a CORS or network block',
      reason:
        'The browser never exposed a status. Confirm Access-Control headers with the CORS Test Tool, or try a same-origin endpoint.',
      actionLabel: 'Open CORS Test Tool',
      path: '/dev-design-tools/cors-test-tool'
    };
  }

  if (looksLikeJsonBody(result.body)) {
    return {
      id: 'pl-json-response',
      title: 'Pretty-print this JSON response?',
      reason: 'The body looks like JSON. Format and validate it without leaving your API workflow.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  const hasAuth = requestHeaders.some(
    (header) =>
      header.key.toLowerCase() === 'authorization' && /bearer\s+\S+/i.test(header.value)
  );
  if (hasAuth) {
    return {
      id: 'pl-jwt',
      title: 'Inspect the Bearer token?',
      reason: 'Authorization looks like a JWT. Decode claims locally before retrying the request.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  if (result.success && hasHeaderEntries(result.headers)) {
    return {
      id: 'pl-headers',
      title: 'Decode these response headers?',
      reason: 'Categorize caching, CORS, and security headers from this successful response.',
      actionLabel: 'Open HTTP Header Decoder',
      path: '/dev-design-tools/http-header-decoder'
    };
  }

  if (result.success) {
    return {
      id: 'pl-codegen',
      title: 'Generate reusable request code?',
      reason: 'This call succeeded. Turn the same URL, method, and headers into fetch, curl, or axios snippets.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  const bodyLooksJson =
    !!requestBody.trim() &&
    (requestBody.trim().startsWith('{') || requestBody.trim().startsWith('['));
  if (bodyLooksJson) {
    return {
      id: 'pl-json-req',
      title: 'Validate the request JSON?',
      reason: 'The body looks like JSON. Lint it before retrying a failing call.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  return null;
}
