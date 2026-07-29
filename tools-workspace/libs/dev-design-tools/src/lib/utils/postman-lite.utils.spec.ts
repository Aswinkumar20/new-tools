import {
  buildHttpHeaders,
  formatBytes,
  formatDuration,
  formatJson,
  formatRelativeTimestamp,
  isLikelyCorsBrowserError,
  looksLikeJsonBody,
  prependPostmanHistory,
  prependSavedRequest,
  resolvePostmanSuggestion,
  resolveSavedRequestName,
  tryParseJson,
  validateJsonBodyIfNeeded
} from './postman-lite.utils';
import type { PostmanHistoryEntry, PostmanRequestResult, PostmanSavedRequest } from '../types/postman-lite.types';
import { POSTMAN_URL_PATTERN } from '../constants/postman-lite.constants';

describe('postman-lite utils', () => {
  it('builds http headers from non-empty pairs', () => {
    expect(
      buildHttpHeaders([
        { key: 'Accept', value: 'application/json' },
        { key: '', value: 'x' },
        { key: 'X-Test', value: '1' }
      ])
    ).toEqual({ Accept: 'application/json', 'X-Test': '1' });
  });

  it('soft-validates JSON when Content-Type claims JSON', () => {
    expect(
      validateJsonBodyIfNeeded([{ key: 'Content-Type', value: 'application/json' }], '{bad')
    ).toBe('Request body is not valid JSON.');
    expect(
      validateJsonBodyIfNeeded([{ key: 'Content-Type', value: 'application/json' }], '{"ok":true}')
    ).toBeNull();
    expect(validateJsonBodyIfNeeded([{ key: 'Accept', value: 'text/plain' }], '{bad')).toBeNull();
  });

  it('formats duration, bytes, timestamps, and JSON', () => {
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatRelativeTimestamp(Date.now() - 10_000)).toBe('Just now');
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(formatJson({ a: 1 })).toContain('"a": 1');
    expect(looksLikeJsonBody('{"ok":true}')).toBe(true);
    expect(looksLikeJsonBody('plain')).toBe(false);
  });

  it('detects likely CORS browser errors', () => {
    expect(isLikelyCorsBrowserError('Failed to fetch')).toBe(true);
    expect(isLikelyCorsBrowserError('CORS policy blocked')).toBe(true);
    expect(isLikelyCorsBrowserError('timeout')).toBe(false);
  });

  it('validates URL pattern constant', () => {
    expect(POSTMAN_URL_PATTERN.test('https://api.github.com')).toBe(true);
    expect(POSTMAN_URL_PATTERN.test('ftp://x')).toBe(false);
  });

  it('resolves saved request names with a timestamp fallback', () => {
    expect(resolveSavedRequestName('  My API  ')).toBe('My API');
    expect(resolveSavedRequestName('  ', 42)).toBe('Request 42');
  });

  it('prepends unique history and saved requests', () => {
    const history: PostmanHistoryEntry = {
      timestamp: 1,
      url: 'https://a.test',
      method: 'GET',
      status: 200,
      success: true
    };
    expect(prependPostmanHistory([], history)).toHaveLength(1);
    expect(prependPostmanHistory([history], history)).toHaveLength(1);

    const saved: PostmanSavedRequest = {
      id: '1',
      name: 'A',
      url: 'https://a.test',
      method: 'GET',
      headers: [],
      body: '',
      timestamp: 1
    };
    expect(prependSavedRequest([], saved)).toHaveLength(1);
    expect(prependSavedRequest([saved], { ...saved, name: 'B' })[0].name).toBe('B');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePostmanSuggestion({
        result: null,
        requestHeaders: [],
        requestBody: '',
        jsonBodyError: true
      })?.id
    ).toBe('pl-json-body');

    const blocked: PostmanRequestResult = {
      success: false,
      status: null,
      statusText: '',
      headers: {},
      body: null,
      error: 'Failed to fetch',
      timestamp: 1,
      duration: 10
    };
    expect(
      resolvePostmanSuggestion({
        result: blocked,
        requestHeaders: [],
        requestBody: '',
        jsonBodyError: false
      })?.id
    ).toBe('pl-cors');

    const jsonOk: PostmanRequestResult = {
      ...blocked,
      success: true,
      status: 200,
      statusText: 'OK',
      error: null,
      body: '{"id":1}',
      headers: { 'content-type': 'application/json' }
    };
    expect(
      resolvePostmanSuggestion({
        result: jsonOk,
        requestHeaders: [],
        requestBody: '',
        jsonBodyError: false
      })?.id
    ).toBe('pl-json-response');
  });
});
