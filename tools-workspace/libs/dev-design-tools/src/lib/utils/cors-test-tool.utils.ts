import type { DdToolSuggestion } from '../shared/dd-tool-suggestion.model';
import { CORS_TEST_HISTORY_LIMIT } from '../constants/cors-test-tool.constants';
import type {
  CorsHeaderPair,
  CorsHistoryEntry,
  CorsRequestInput,
  CorsTestResult
} from '../types/cors-test-tool.types';

export function buildHttpHeaders(headers: ReadonlyArray<CorsHeaderPair>): Record<string, string> {
  const httpHeaders: Record<string, string> = {};
  for (const header of headers) {
    if (header.key && header.value) {
      httpHeaders[header.key] = header.value;
    }
  }
  return httpHeaders;
}

export function extractResponseHeaderMaps(response: Response): {
  allHeaders: Record<string, string>;
  corsHeaders: Record<string, string>;
} {
  const allHeaders: Record<string, string> = {};
  const corsHeaders: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    allHeaders[key] = value;
    if (key.toLowerCase().startsWith('access-control-')) {
      corsHeaders[key] = value;
    }
  });

  return { allHeaders, corsHeaders };
}

export function findAccessControlAllowOrigin(corsHeaders: Record<string, string>): string | undefined {
  return (
    corsHeaders['access-control-allow-origin'] ??
    Object.entries(corsHeaders).find(([key]) => key.toLowerCase() === 'access-control-allow-origin')?.[1]
  );
}

export function buildCorsAnalysisNotes(
  corsHeaders: Record<string, string>,
  origin: string
): string[] {
  const notes: string[] = [
    `This page origin is ${origin || '(unknown)'}. True CORS blocks usually throw before headers are readable.`
  ];
  const acao = findAccessControlAllowOrigin(corsHeaders);

  if (!acao) {
    notes.push('No Access-Control-Allow-Origin header was exposed. Same-origin responses often omit CORS headers.');
  } else if (acao !== '*' && origin && acao !== origin) {
    notes.push(`ACAO "${acao}" does not match this origin ${origin}.`);
  } else {
    notes.push(`ACAO looks compatible: ${acao}`);
  }

  return notes;
}

export function isLikelyCorsBrowserError(message: string): boolean {
  return (
    message.includes('CORS') ||
    message.includes('Access-Control') ||
    /Failed to fetch/i.test(message) ||
    /NetworkError/i.test(message)
  );
}

export function headersToList(headers: Record<string, string>): CorsHeaderPair[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

export function corsHeadersToList(headers: Record<string, string>): CorsHeaderPair[] {
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase().startsWith('access-control-'))
    .map(([key, value]) => ({ key, value }));
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

export function prependCorsHistory(
  entries: CorsHistoryEntry[],
  entry: CorsHistoryEntry,
  limit = CORS_TEST_HISTORY_LIMIT
): CorsHistoryEntry[] {
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

export async function executeCorsRequest(input: CorsRequestInput): Promise<CorsTestResult> {
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
    const { allHeaders, corsHeaders } = extractResponseHeaderMaps(response);

    let responseBody: string | null = null;
    try {
      responseBody = await response.text();
    } catch {
      responseBody = null;
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: allHeaders,
      corsHeaders,
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
      corsHeaders: {},
      body: null,
      error: errorMessage,
      timestamp: Date.now(),
      duration
    };
  }
}

export function resolveCorsTestSuggestion(options: {
  result: CorsTestResult | null;
  requestHeaders: ReadonlyArray<CorsHeaderPair>;
}): DdToolSuggestion | null {
  const { result, requestHeaders } = options;
  if (!result) {
    return null;
  }

  const errorText = result.error ?? '';
  if (!result.success && result.status === null && isLikelyCorsBrowserError(errorText)) {
    return {
      id: 'ctt-cors-blocked',
      title: 'Browser blocked this cross-origin request',
      reason:
        'The fetch never exposed response headers. Confirm the server sends Access-Control-Allow-Origin for this site, or craft a same-origin proxy request next.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  if (looksLikeJsonBody(result.body)) {
    return {
      id: 'ctt-json-format',
      title: 'Pretty-print this JSON response?',
      reason: 'The body looks like JSON. The formatter can validate and beautify it without leaving your workflow.',
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
      id: 'ctt-jwt',
      title: 'Inspect the Bearer token?',
      reason: 'Authorization looks like a JWT. Decode claims locally before retrying the CORS call.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  if (result.success && hasHeaderEntries(result.corsHeaders)) {
    return {
      id: 'ctt-speed',
      title: 'Measure download speed next?',
      reason: 'CORS looks reachable. Network Speed Test can time larger downloads against the same host.',
      actionLabel: 'Open Network Speed Test',
      path: '/browser-utils/network-speed-test'
    };
  }

  if (result.success && !hasHeaderEntries(result.corsHeaders)) {
    return {
      id: 'ctt-http-builder',
      title: 'Build a reusable HTTP snippet?',
      reason:
        'No ACAO header was exposed (common for same-origin). Generate a request template for further API checks.',
      actionLabel: 'Open HTTP Request Generator',
      path: '/dev-design-tools/http-request-generator'
    };
  }

  return null;
}
