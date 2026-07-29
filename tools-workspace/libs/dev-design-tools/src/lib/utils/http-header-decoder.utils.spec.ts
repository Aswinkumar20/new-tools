import {
  categorizeHeaderKey,
  createDecodedHeader,
  decodeHttpHeaders,
  exportHeadersAsJson,
  exportHeadersAsRaw,
  formatRelativeTimestamp,
  parseKeyValueHeaders,
  parseRawHeaders,
  prependHeaderHistory,
  resolveHttpHeaderSuggestion
} from './http-header-decoder.utils';
import type { HeaderHistoryEntry } from '../types/http-header-decoder.types';

describe('http-header-decoder utils', () => {
  it('categorizes known header keys', () => {
    expect(categorizeHeaderKey('access-control-allow-origin')).toBe('cors');
    expect(categorizeHeaderKey('content-type')).toBe('entity');
    expect(categorizeHeaderKey('authorization')).toBe('request');
    expect(categorizeHeaderKey('set-cookie')).toBe('response');
    expect(categorizeHeaderKey('x-custom')).toBe('custom');
  });

  it('parses raw headers and status lines', () => {
    const { headers, warnings } = parseRawHeaders(
      'HTTP/1.1 200 OK\nContent-Type: application/json\nskipped-line\nAccept: */*'
    );
    expect(headers[0].key).toBe('Status-Line');
    expect(headers.some((h) => h.key === 'Content-Type')).toBe(true);
    expect(warnings[0]).toContain("missing ':'");
  });

  it('parses JSON key-value mode and falls back to raw', () => {
    const json = parseKeyValueHeaders('{"Accept":"application/json","Host":"example.com"}');
    expect(json.headers).toHaveLength(2);
    expect(json.warnings).toEqual([]);

    const fallback = parseKeyValueHeaders('Accept: application/json');
    expect(fallback.headers.some((h) => h.key === 'Accept')).toBe(true);
    expect(fallback.warnings[0]).toContain('not valid JSON');
  });

  it('decodes by mode and exports formats', () => {
    const decoded = decodeHttpHeaders('Authorization: Bearer abc.def.ghi', 'raw');
    expect(decoded.headers[0].category).toBe('request');
    expect(exportHeadersAsJson(decoded.headers)).toContain('"Authorization"');
    expect(exportHeadersAsRaw(decoded.headers)).toBe('Authorization: Bearer abc.def.ghi');
  });

  it('creates descriptions and formats timestamps', () => {
    expect(createDecodedHeader('Content-Type', 'text/plain').description).toContain('media type');
    expect(formatRelativeTimestamp(Date.now() - 5_000)).toBe('Just now');
  });

  it('prepends unique history by raw input', () => {
    const entry: HeaderHistoryEntry = {
      timestamp: 1,
      headers: [],
      rawInput: 'Accept: */*'
    };
    expect(prependHeaderHistory([entry], entry)).toHaveLength(1);
    expect(prependHeaderHistory([], { ...entry, rawInput: 'other' })).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveHttpHeaderSuggestion([])).toBeNull();
    expect(
      resolveHttpHeaderSuggestion([createDecodedHeader('Access-Control-Allow-Origin', '*')])?.id
    ).toBe('hhd-cors');
    expect(
      resolveHttpHeaderSuggestion([createDecodedHeader('Authorization', 'Bearer token.here')])?.id
    ).toBe('hhd-jwt');
    expect(resolveHttpHeaderSuggestion([createDecodedHeader('User-Agent', 'Mozilla/5.0')])?.id).toBe(
      'hhd-ua'
    );
    expect(
      resolveHttpHeaderSuggestion([createDecodedHeader('Content-Type', 'application/json')])?.id
    ).toBe('hhd-json');
    expect(resolveHttpHeaderSuggestion([createDecodedHeader('X-Custom', '1')])?.id).toBe('hhd-http');
  });
});
