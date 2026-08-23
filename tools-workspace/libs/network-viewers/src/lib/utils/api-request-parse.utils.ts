import type { ApiCall, ApiHeader, ApiRequestDataset, ApiRequestSourceKind } from '../types/api-request-viewer.types';
import { parseHarText } from './har-parse.utils';
import { parseHttpTraceText } from './http-trace-parse.utils';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function prettyBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

function asHeaders(value: unknown): ApiHeader[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const rec = item as Record<string, unknown>;
        return { name: asString(rec.name ?? rec.key), value: asString(rec.value) };
      })
      .filter((h) => h.name);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, val]) => ({
      name,
      value: asString(val)
    }));
  }
  return [];
}

function parseUrlParts(url: string): { host: string; path: string; query: ApiHeader[] } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      path: `${parsed.pathname}${parsed.search}`,
      query: [...parsed.searchParams.entries()].map(([name, value]) => ({ name, value }))
    };
  } catch {
    const match = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(url);
    return { host: match?.[1] ?? '', path: match?.[2] ?? url, query: [] };
  }
}

function finishCall(
  partial: Omit<ApiCall, 'prettyRequest' | 'prettyResponse' | 'host' | 'path' | 'query'> & {
    host?: string;
    path?: string;
    query?: ApiHeader[];
  }
): ApiCall {
  const parts = parseUrlParts(partial.url);
  return {
    ...partial,
    host: partial.host || parts.host,
    path: partial.path || parts.path,
    query: partial.query?.length ? partial.query : parts.query,
    prettyRequest: prettyBody(partial.requestBody),
    prettyResponse: prettyBody(partial.responseBody)
  };
}

function finishDataset(
  name: string,
  baseUrl: string,
  sourceKind: ApiRequestSourceKind,
  calls: ApiCall[],
  warnings: string[]
): ApiRequestDataset {
  if (!calls.length) warnings.push('API dump contains no requests.');
  return { name, baseUrl, sourceKind, calls, warnings };
}

export function parseApiJson(data: unknown): ApiRequestDataset {
  if (!data || typeof data !== 'object') throw new Error('API JSON must be an object');
  const rec = data as Record<string, unknown>;
  const info = rec.info && typeof rec.info === 'object' ? (rec.info as Record<string, unknown>) : {};
  const raw = Array.isArray(rec.requests)
    ? rec.requests
    : Array.isArray(rec.item)
      ? rec.item
      : Array.isArray(rec.calls)
        ? rec.calls
        : null;
  if (!raw) throw new Error('API JSON is missing requests');
  const warnings: string[] = [];
  const calls: ApiCall[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const request = (row.request && typeof row.request === 'object' ? row.request : row) as Record<string, unknown>;
    const responseRaw = Array.isArray(row.response) ? row.response[0] : row.response;
    const response = (responseRaw && typeof responseRaw === 'object' ? responseRaw : row) as Record<string, unknown>;
    const urlValue = request.url;
    const url =
      typeof urlValue === 'string'
        ? urlValue
        : urlValue && typeof urlValue === 'object'
          ? asString((urlValue as Record<string, unknown>).raw ?? (urlValue as Record<string, unknown>).href)
          : asString(row.url);
    const body = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
    return finishCall({
      id: asString(row.id, `a-${i + 1}`),
      index: i,
      name: asString(row.name, `${asString(request.method ?? row.method, 'GET')} ${url || '/'}`),
      method: asString(request.method ?? row.method, 'GET').toUpperCase(),
      url,
      status: Math.round(asNumber(row.status ?? response.code ?? response.status)),
      statusText: asString(row.statusText ?? response.status),
      mimeType: asString(row.mimeType, 'application/json'),
      requestHeaders: asHeaders(row.requestHeaders ?? request.header ?? request.headers),
      responseHeaders: asHeaders(row.responseHeaders ?? response.header ?? response.headers),
      requestBody: asString(row.requestBody ?? body.raw ?? request.body).slice(0, 12000),
      responseBody: asString(row.responseBody ?? response.body ?? response.text).slice(0, 12000),
      durationMs: asNumber(row.durationMs ?? row.time ?? response.time)
    });
  });
  const baseUrl = asString(rec.baseUrl ?? rec.baseURL, calls[0] ? `https://${calls[0].host}` : '');
  return finishDataset(asString(rec.name ?? info.name, 'API collection'), baseUrl, 'json', calls, warnings);
}

function parseHttpFile(text: string): ApiRequestDataset {
  const blocks = text
    .split(/^###\s*/m)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!blocks.length) throw new Error('.http file has no ### request blocks');
  const calls: ApiCall[] = blocks.map((block, i) => {
    const lines = block.split(/\r?\n/);
    const name = lines[0]?.trim() || `Request ${i + 1}`;
    const rest = /^[A-Z]+\s+/i.test(lines[0] || '') ? block : lines.slice(1).join('\n');
    const firstLine = rest.trim().split('\n')[0] ?? '';
    const match = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i.exec(firstLine);
    const method = (match?.[1] || 'GET').toUpperCase();
    const url = match?.[2] || '';
    const after = rest.trim().split('\n').slice(1).join('\n');
    const split = after.replace(/\r\n/g, '\n').indexOf('\n\n');
    const head = split >= 0 ? after.slice(0, split) : after;
    const body = split >= 0 ? after.slice(split + 2).trim() : '';
    const requestHeaders: ApiHeader[] = [];
    for (const line of head.split('\n')) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      requestHeaders.push({ name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
    }
    return finishCall({
      id: `a-${i + 1}`,
      index: i,
      name,
      method,
      url,
      status: 0,
      statusText: '',
      mimeType: requestHeaders.find((h) => h.name.toLowerCase() === 'content-type')?.value || 'application/json',
      requestHeaders,
      responseHeaders: [],
      requestBody: body.slice(0, 12000),
      responseBody: '',
      durationMs: 0
    });
  });
  return finishDataset(calls[0]?.host ? `${calls[0].host} .http` : 'HTTP collection', '', 'http', calls, []);
}

export function parseApiRequestText(text: string, fileName = ''): ApiRequestDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('API dump is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid API JSON');
    }
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    if (rec.log || (Array.isArray(rec.entries) && !rec.requests && !rec.item)) {
      const har = parseHarText(trimmed);
      const calls = har.entries.map((e, i) =>
        finishCall({
          id: e.id,
          index: i,
          name: `${e.method} ${e.path}`,
          method: e.method,
          url: e.url,
          host: e.host,
          path: e.path,
          status: e.status,
          statusText: e.statusText,
          mimeType: e.mimeType,
          requestHeaders: e.requestHeaders,
          responseHeaders: e.responseHeaders,
          query: e.queryString,
          requestBody: e.requestBody,
          responseBody: e.responseBody,
          durationMs: e.time
        })
      );
      return finishDataset(har.pageTitle || fileName || 'HAR API dump', '', 'har', calls, har.warnings);
    }
    return parseApiJson(data);
  }
  if (/^###/m.test(trimmed) || /\.http$/i.test(fileName)) return parseHttpFile(trimmed);
  const trace = parseHttpTraceText(trimmed);
  const calls = trace.exchanges.map((e, i) =>
    finishCall({
      id: e.id,
      index: i,
      name: `${e.method} ${e.path}`,
      method: e.method,
      url: e.url,
      host: e.host,
      path: e.path,
      status: e.status,
      statusText: e.statusText,
      mimeType: e.mimeType,
      requestHeaders: e.requestHeaders,
      responseHeaders: e.responseHeaders,
      requestBody: e.requestBody,
      responseBody: e.responseBody,
      durationMs: e.durationMs
    })
  );
  return finishDataset(trace.name, '', 'http', calls, trace.warnings);
}

export function parseApiRequestBytes(bytes: Uint8Array, fileName = ''): ApiRequestDataset {
  if (!bytes.length) throw new Error('API dump is empty');
  return parseApiRequestText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterApiCalls(calls: ApiCall[], query: string): ApiCall[] {
  const q = query.trim().toLowerCase();
  if (!q) return calls;
  const tokens = q.split(/\s+/).filter(Boolean);
  return calls.filter((c) =>
    tokens.every((token) => {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(token)) {
        return c.method.toLowerCase() === token;
      }
      if (token === 'host' || token === 'port') return true;
      if (/^\d{3}$/.test(token)) return c.status === Number(token);
      if (token === '4xx') return c.status >= 400 && c.status < 500;
      if (token === '2xx') return c.status >= 200 && c.status < 300;
      const hay = `${c.name} ${c.method} ${c.url} ${c.host} ${c.path} ${c.status} ${c.mimeType}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
