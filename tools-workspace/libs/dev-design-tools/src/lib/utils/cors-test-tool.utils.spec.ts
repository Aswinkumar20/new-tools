import {
  buildCorsAnalysisNotes,
  buildHttpHeaders,
  formatDuration,
  formatJson,
  formatRelativeTimestamp,
  isLikelyCorsBrowserError,
  looksLikeJsonBody,
  prependCorsHistory,
  resolveCorsTestSuggestion,
  tryParseJson
} from './cors-test-tool.utils';
import type { CorsHistoryEntry, CorsTestResult } from '../types/cors-test-tool.types';
import { CORS_URL_PATTERN } from '../constants/cors-test-tool.constants';

describe('cors-test-tool utils', () => {
  it('builds http headers from non-empty pairs', () => {
    expect(
      buildHttpHeaders([
        { key: 'Accept', value: 'application/json' },
        { key: '', value: 'x' },
        { key: 'X-Test', value: '1' }
      ])
    ).toEqual({ Accept: 'application/json', 'X-Test': '1' });
  });

  it('analyzes ACAO notes for missing and mismatched origins', () => {
    const missing = buildCorsAnalysisNotes({}, 'https://app.example');
    expect(missing.some((note) => note.includes('No Access-Control-Allow-Origin'))).toBe(true);

    const mismatch = buildCorsAnalysisNotes(
      { 'access-control-allow-origin': 'https://other.example' },
      'https://app.example'
    );
    expect(mismatch.some((note) => note.includes('does not match'))).toBe(true);

    const ok = buildCorsAnalysisNotes({ 'access-control-allow-origin': '*' }, 'https://app.example');
    expect(ok.some((note) => note.includes('compatible'))).toBe(true);
  });

  it('detects likely CORS browser errors', () => {
    expect(isLikelyCorsBrowserError('Failed to fetch')).toBe(true);
    expect(isLikelyCorsBrowserError('CORS policy blocked')).toBe(true);
    expect(isLikelyCorsBrowserError('timeout')).toBe(false);
  });

  it('formats duration, timestamps, and JSON', () => {
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatRelativeTimestamp(Date.now() - 10_000)).toBe('Just now');
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(formatJson({ a: 1 })).toContain('"a": 1');
    expect(looksLikeJsonBody('{"ok":true}')).toBe(true);
    expect(looksLikeJsonBody('plain')).toBe(false);
  });

  it('validates URL pattern constant', () => {
    expect(CORS_URL_PATTERN.test('https://api.github.com')).toBe(true);
    expect(CORS_URL_PATTERN.test('ftp://x')).toBe(false);
  });

  it('prepends unique history entries', () => {
    const entry: CorsHistoryEntry = {
      timestamp: 1,
      url: 'https://a.test',
      method: 'GET',
      success: true,
      status: 200,
      corsHeaders: {}
    };
    expect(prependCorsHistory([], entry)).toHaveLength(1);
    expect(prependCorsHistory([entry], entry)).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    const blocked: CorsTestResult = {
      success: false,
      status: null,
      statusText: '',
      headers: {},
      corsHeaders: {},
      body: null,
      error: 'Failed to fetch',
      timestamp: 1,
      duration: 10
    };
    expect(resolveCorsTestSuggestion({ result: blocked, requestHeaders: [] })?.id).toBe('ctt-cors-blocked');

    const jsonOk: CorsTestResult = {
      ...blocked,
      success: true,
      status: 200,
      statusText: 'OK',
      error: null,
      body: '{"id":1}',
      corsHeaders: { 'access-control-allow-origin': '*' }
    };
    expect(resolveCorsTestSuggestion({ result: jsonOk, requestHeaders: [] })?.id).toBe('ctt-json-format');

    expect(resolveCorsTestSuggestion({ result: null, requestHeaders: [] })).toBeNull();
  });
});
