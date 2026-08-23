import type { HarEntry } from '../types/har-viewer.types';
import type {
  HttpTraceDataset,
  HttpTraceExchange,
  HttpTraceHeader,
  HttpTraceSourceKind
} from '../types/http-trace-viewer.types';
import { parseHarText } from './har-parse.utils';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asHeaders(value: unknown): HttpTraceHeader[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const rec = item as Record<string, unknown>;
        return { name: asString(rec.name), value: asString(rec.value) };
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

function parseUrlParts(url: string, hostFallback = ''): { host: string; path: string; url: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, path: `${parsed.pathname}${parsed.search}`, url };
  } catch {
    const match = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(url);
    if (match) return { host: match[1], path: match[2] || '/', url };
    const path = url.startsWith('/') ? url : `/${url}`;
    const host = hostFallback;
    return { host, path, url: host ? `https://${host}${path}` : path };
  }
}

function headerValue(headers: HttpTraceHeader[], name: string): string {
  const hit = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return hit?.value ?? '';
}

export function exchangesFromHarEntries(entries: HarEntry[], warnings: string[] = []): HttpTraceExchange[] {
  return entries.map((e, i) => ({
    id: e.id || `e-${i + 1}`,
    index: i,
    method: e.method,
    url: e.url,
    host: e.host,
    path: e.path,
    status: e.status,
    statusText: e.statusText,
    httpVersion: 'HTTP/1.1',
    requestHeaders: e.requestHeaders,
    responseHeaders: e.responseHeaders,
    requestBody: e.requestBody,
    responseBody: e.responseBody,
    mimeType: e.mimeType,
    durationMs: e.time,
    startMs: e.startMs
  }));
}

function finishDataset(
  name: string,
  sourceKind: HttpTraceSourceKind,
  exchanges: HttpTraceExchange[],
  warnings: string[]
): HttpTraceDataset {
  const totalDurationMs = exchanges.reduce((max, e) => Math.max(max, e.startMs + e.durationMs), 0);
  if (!exchanges.length) warnings.push('HTTP trace contains no request/response pairs.');
  return { name, sourceKind, exchanges, totalDurationMs, warnings };
}

function parseHeaderBlock(text: string): { headers: HttpTraceHeader[]; body: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  const split = normalized.indexOf('\n\n');
  const head = split >= 0 ? normalized.slice(0, split) : normalized;
  const body = split >= 0 ? normalized.slice(split + 2).trim() : '';
  const headers: HttpTraceHeader[] = [];
  for (const line of head.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    headers.push({ name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
  }
  return { headers, body: body.slice(0, 8000) };
}

function parseRequestBlock(text: string, index: number, startMs: number): HttpTraceExchange | null {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const first = lines[0] ?? '';
  const match = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(\S+)(?:\s+(HTTP\/[\d.]+))?/i.exec(first);
  if (!match) return null;
  const method = match[1].toUpperCase();
  const target = match[2];
  const httpVersion = match?.[3] || 'HTTP/1.1';
  const rest = lines.slice(1).join('\n');
  const { headers, body } = parseHeaderBlock(rest);
  const host = headerValue(headers, 'Host');
  const parts = parseUrlParts(target, host);
  return {
    id: `e-${index + 1}`,
    index,
    method,
    url: parts.url,
    host: parts.host || host,
    path: parts.path,
    status: 0,
    statusText: '',
    httpVersion,
    requestHeaders: headers,
    responseHeaders: [],
    requestBody: body,
    responseBody: '',
    mimeType: headerValue(headers, 'Accept') || headerValue(headers, 'Content-Type') || 'unknown',
    durationMs: 0,
    startMs
  };
}

function applyResponseBlock(exchange: HttpTraceExchange, text: string): void {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const first = lines[0] ?? '';
  const match = /^HTTP\/[\d.]+\s+(\d{3})\s*(.*)$/i.exec(first);
  exchange.status = match ? Number(match[1]) : 0;
  exchange.statusText = match?.[2]?.trim() ?? '';
  const { headers, body } = parseHeaderBlock(lines.slice(1).join('\n'));
  exchange.responseHeaders = headers;
  exchange.responseBody = body;
  const mime = headerValue(headers, 'Content-Type');
  if (mime) exchange.mimeType = mime.split(';')[0].trim();
  if (!exchange.durationMs) exchange.durationMs = Math.max(8, body.length % 180);
}

function parseMarkedTrace(text: string): HttpTraceExchange[] {
  const chunks = text
    .split(/^>>>/m)
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith('#'));
  return chunks
    .map((chunk, i) => {
      const [req, res] = chunk.split(/^<<</m);
      const exchange = parseRequestBlock(req ?? '', i, i * 24);
      if (exchange && res) applyResponseBlock(exchange, res);
      return exchange;
    })
    .filter((e): e is HttpTraceExchange => !!e);
}

function parseUnlabeledTrace(text: string): HttpTraceExchange[] {
  const blocks = text
    .split(/\n(?=(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+)/i)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block, i) => {
      const resIdx = block.search(/\nHTTP\/[\d.]+\s+\d{3}/i);
      const req = resIdx >= 0 ? block.slice(0, resIdx) : block;
      const res = resIdx >= 0 ? block.slice(resIdx + 1) : '';
      const exchange = parseRequestBlock(req, i, i * 24);
      if (exchange && res) applyResponseBlock(exchange, res);
      return exchange;
    })
    .filter((e): e is HttpTraceExchange => !!e);
}

export function parseHttpTraceJson(data: unknown): HttpTraceDataset {
  if (!data || typeof data !== 'object') throw new Error('HTTP trace JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.exchanges)
    ? rec.exchanges
    : Array.isArray(rec.requests)
      ? rec.requests
      : Array.isArray(rec.entries)
        ? rec.entries
        : null;
  if (!raw) throw new Error('HTTP trace JSON is missing exchanges');
  const warnings: string[] = [];
  const exchanges: HttpTraceExchange[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const request = (row.request && typeof row.request === 'object' ? row.request : row) as Record<string, unknown>;
    const response = (row.response && typeof row.response === 'object' ? row.response : row) as Record<string, unknown>;
    const url = asString(row.url ?? request.url);
    const headers = asHeaders(row.requestHeaders ?? request.headers);
    const host = asString(row.host, headerValue(headers, 'Host'));
    const parts = parseUrlParts(url, host);
    return {
      id: asString(row.id, `e-${i + 1}`),
      index: i,
      method: asString(row.method ?? request.method, 'GET').toUpperCase(),
      url: parts.url,
      host: parts.host,
      path: parts.path,
      status: Math.round(asNumber(row.status ?? response.status)),
      statusText: asString(row.statusText ?? response.statusText),
      httpVersion: asString(row.httpVersion, 'HTTP/1.1'),
      requestHeaders: headers,
      responseHeaders: asHeaders(row.responseHeaders ?? response.headers),
      requestBody: asString(row.requestBody ?? request.body).slice(0, 8000),
      responseBody: asString(row.responseBody ?? response.body ?? response.content).slice(0, 8000),
      mimeType: asString(row.mimeType, 'unknown'),
      durationMs: asNumber(row.durationMs ?? row.time),
      startMs: asNumber(row.startMs, i * 24)
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'HTTP trace'), 'json', exchanges, warnings);
}

export function parseHttpTraceText(text: string): HttpTraceDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('HTTP trace is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid HTTP trace JSON');
    }
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    if (rec.log || Array.isArray((rec as { entries?: unknown }).entries)) {
      const har = parseHarText(trimmed);
      return finishDataset(har.pageTitle || 'HAR trace', 'har', exchangesFromHarEntries(har.entries), har.warnings);
    }
    return parseHttpTraceJson(data);
  }
  const nameMatch = /^#\s*HTTP TRACE\s+(.+)$/im.exec(trimmed);
  const name = nameMatch?.[1]?.trim() || 'HTTP trace';
  const exchanges = /^>>>/m.test(trimmed) ? parseMarkedTrace(trimmed) : parseUnlabeledTrace(trimmed);
  if (!exchanges.length) throw new Error('No HTTP request/response pairs found');
  return finishDataset(name, 'trace', exchanges, []);
}

export function parseHttpTraceBytes(bytes: Uint8Array, fileName = ''): HttpTraceDataset {
  if (!bytes.length) throw new Error('HTTP trace file is empty');
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const parsed = parseHttpTraceText(text);
  if (/\.har$/i.test(fileName) && parsed.sourceKind !== 'har') {
    return { ...parsed, sourceKind: parsed.sourceKind === 'json' ? 'json' : parsed.sourceKind };
  }
  return parsed;
}

export function filterHttpExchanges(exchanges: HttpTraceExchange[], query: string): HttpTraceExchange[] {
  const q = query.trim().toLowerCase();
  if (!q) return exchanges;
  const tokens = q.split(/\s+/).filter(Boolean);
  return exchanges.filter((e) =>
    tokens.every((token) => {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(token)) {
        return e.method.toLowerCase() === token;
      }
      if (token === 'host' || token === 'port') return true;
      if (/^\d{3}$/.test(token)) return e.status === Number(token);
      if (token === '4xx') return e.status >= 400 && e.status < 500;
      if (token === '5xx') return e.status >= 500;
      if (token === '2xx') return e.status >= 200 && e.status < 300;
      const hay = `${e.method} ${e.url} ${e.host} ${e.path} ${e.status} ${e.statusText} ${e.mimeType}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function formatConversationText(dataset: HttpTraceDataset): string {
  const lines = [`# HTTP TRACE ${dataset.name}`, ''];
  for (const e of dataset.exchanges) {
    lines.push(`>>> ${e.method} ${e.path || e.url} ${e.httpVersion}`);
    for (const h of e.requestHeaders) lines.push(`${h.name}: ${h.value}`);
    if (e.requestBody) lines.push('', e.requestBody);
    lines.push('');
    lines.push(`<<< ${e.httpVersion} ${e.status} ${e.statusText}`.trim());
    for (const h of e.responseHeaders) lines.push(`${h.name}: ${h.value}`);
    if (e.responseBody) lines.push('', e.responseBody);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
