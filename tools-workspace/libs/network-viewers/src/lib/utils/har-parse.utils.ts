import { HAR_MAX_ENTRIES } from '../constants/har-viewer.constants';
import type { HarDataset, HarEntry, HarHeader, HarTiming } from '../types/har-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asHeaders(value: unknown): HarHeader[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const rec = item as Record<string, unknown>;
      return { name: asString(rec.name), value: asString(rec.value) };
    })
    .filter((h) => h.name);
}

function timingValue(value: unknown): number {
  const n = asNumber(value, -1);
  return n < 0 ? 0 : n;
}

function parseUrlParts(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, path: `${parsed.pathname}${parsed.search}` };
  } catch {
    const match = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(url);
    return { host: match?.[1] ?? '', path: match?.[2] ?? url };
  }
}

function parseTimings(raw: unknown): HarTiming {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    blocked: timingValue(rec.blocked),
    dns: timingValue(rec.dns),
    connect: timingValue(rec.connect),
    ssl: timingValue(rec.ssl),
    send: timingValue(rec.send),
    wait: timingValue(rec.wait),
    receive: timingValue(rec.receive)
  };
}

function headerSizeHint(headers: HarHeader[]): number {
  return headers.reduce((sum, h) => sum + h.name.length + h.value.length + 4, 0);
}

export function filterHarEntries(entries: HarEntry[], query: string): HarEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => {
    const hay = `${entry.method} ${entry.url} ${entry.status} ${entry.mimeType} ${entry.host} ${entry.path}`.toLowerCase();
    return hay.includes(q);
  });
}

export function parseHarText(text: string): HarDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('HAR file is empty');
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid HAR JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('HAR root must be an object');
  const root = data as Record<string, unknown>;
  const log = (root.log && typeof root.log === 'object' ? root.log : root) as Record<string, unknown>;
  const rawEntries = Array.isArray(log.entries) ? log.entries : Array.isArray(root.entries) ? root.entries : null;
  if (!rawEntries) throw new Error('HAR file is missing log.entries');
  const warnings: string[] = [];
  if (rawEntries.length > HAR_MAX_ENTRIES) {
    warnings.push(`Only the first ${HAR_MAX_ENTRIES} of ${rawEntries.length} entries are shown.`);
  }
  const slice = rawEntries.slice(0, HAR_MAX_ENTRIES);
  const creator = log.creator && typeof log.creator === 'object' ? (log.creator as Record<string, unknown>) : {};
  const browser = log.browser && typeof log.browser === 'object' ? (log.browser as Record<string, unknown>) : {};
  const pages = Array.isArray(log.pages) ? log.pages : [];
  const firstPage = pages[0] && typeof pages[0] === 'object' ? (pages[0] as Record<string, unknown>) : {};

  const parsedEntries: HarEntry[] = [];
  let minStart = Infinity;
  for (let i = 0; i < slice.length; i++) {
    const rec = (slice[i] && typeof slice[i] === 'object' ? slice[i] : {}) as Record<string, unknown>;
    const request = (rec.request && typeof rec.request === 'object' ? rec.request : {}) as Record<string, unknown>;
    const response = (rec.response && typeof rec.response === 'object' ? rec.response : {}) as Record<string, unknown>;
    const content = (response.content && typeof response.content === 'object' ? response.content : {}) as Record<string, unknown>;
    const postData = (request.postData && typeof request.postData === 'object' ? request.postData : {}) as Record<string, unknown>;
    const url = asString(request.url, asString(rec.url));
    const { host, path } = parseUrlParts(url);
    const timings = parseTimings(rec.timings);
    const startedDateTime = asString(rec.startedDateTime);
    const startAbs = Date.parse(startedDateTime);
    if (!Number.isFinite(startAbs)) warnings.push(`Entry ${i + 1} has an invalid startedDateTime.`);
    if (Number.isFinite(startAbs) && startAbs < minStart) minStart = startAbs;
    const reqHeaders = asHeaders(request.headers);
    const resHeaders = asHeaders(response.headers);
    const bodySize = asNumber(response.bodySize, asNumber(content.size));
    const transferSize =
      Math.max(0, asNumber(response.headersSize, headerSizeHint(resHeaders))) +
      Math.max(0, bodySize) +
      Math.max(0, asNumber(request.headersSize, headerSizeHint(reqHeaders))) +
      Math.max(0, asNumber(request.bodySize));
    const timingSum = timings.blocked + timings.dns + timings.connect + timings.send + timings.wait + timings.receive;
    parsedEntries.push({
      id: `e-${i + 1}`,
      index: i,
      startedDateTime,
      startMs: Number.isFinite(startAbs) ? startAbs : 0,
      time: Math.max(asNumber(rec.time, timingSum), timingSum),
      method: asString(request.method, 'GET').toUpperCase(),
      url,
      host,
      path,
      status: Math.round(asNumber(response.status)),
      statusText: asString(response.statusText),
      mimeType: asString(content.mimeType, asString(response.mimeType, 'unknown')),
      requestHeaders: reqHeaders,
      responseHeaders: resHeaders,
      queryString: asHeaders(request.queryString),
      requestBody: asString(postData.text).slice(0, 8000),
      responseBody: asString(content.text).slice(0, 8000),
      timings,
      serverIPAddress: asString(rec.serverIPAddress),
      bodySize: Math.max(0, bodySize),
      transferSize
    });
  }
  if (!Number.isFinite(minStart)) minStart = parsedEntries[0]?.startMs ?? 0;
  parsedEntries.forEach((entry) => {
    entry.startMs = Math.max(0, entry.startMs - minStart);
  });
  if (!parsedEntries.length) warnings.push('HAR contains no request entries.');
  const totalTimeMs = parsedEntries.reduce((max, e) => Math.max(max, e.startMs + e.time), 0);
  const totalTransfer = parsedEntries.reduce((sum, e) => sum + e.transferSize, 0);
  return {
    version: asString(log.version, '1.2'),
    creator: [asString(creator.name, 'unknown'), asString(creator.version)].filter(Boolean).join(' '),
    browser: [asString(browser.name), asString(browser.version)].filter(Boolean).join(' '),
    pageTitle: asString(firstPage.title, asString(log.comment, 'HAR capture')),
    startedDateTime: asString(firstPage.startedDateTime, parsedEntries[0]?.startedDateTime ?? ''),
    entries: parsedEntries,
    totalTimeMs,
    totalTransfer,
    warnings
  };
}
