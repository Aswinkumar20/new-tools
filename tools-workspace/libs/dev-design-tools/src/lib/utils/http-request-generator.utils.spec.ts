import {
  formatBodyForCode,
  generateAxiosCode,
  generateCurlCode,
  generateFetchCode,
  generateHttpRequestCode,
  generatePythonCode,
  getCodeFormatLabel,
  prependHttpRequestHistory,
  resolveHttpRequestSuggestion,
  validateHttpRequestUrl
} from './http-request-generator.utils';
import type { HttpRequestHistoryEntry } from '../types/http-request-generator.types';

describe('http-request-generator utils', () => {
  const headers = { 'Content-Type': 'application/json' };

  it('validates URLs', () => {
    expect(validateHttpRequestUrl('')).toBe('URL is required.');
    expect(validateHttpRequestUrl('ftp://x')).toBe('URL must start with http:// or https://.');
    expect(validateHttpRequestUrl('https://api.example.com')).toBeNull();
  });

  it('generates fetch, axios, curl, and python snippets', () => {
    expect(generateFetchCode('https://a.test', 'GET', headers, '')).toContain("method: 'GET'");
    expect(generateAxiosCode('https://a.test', 'POST', headers, '{"a":1}')).toContain('axios.post');
    expect(generateCurlCode('https://a.test', 'POST', headers, '{"a":1}')).toContain('-H');
    expect(generatePythonCode('https://a.test', 'GET', headers, '')).toContain('import requests');
  });

  it('routes formats through generateHttpRequestCode', () => {
    const code = generateHttpRequestCode({
      url: 'https://a.test',
      method: 'GET',
      headers: [{ key: 'Accept', value: '*/*' }],
      body: '',
      codeFormat: 'curl'
    });
    expect(code).toContain('curl -X GET');
    expect(getCodeFormatLabel('curl')).toBe('cURL');
  });

  it('formats JSON and plain bodies', () => {
    expect(formatBodyForCode('{"a":1}')).toBe('{"a":1}');
    expect(formatBodyForCode("it's")).toContain("\\'");
  });

  it('prepends unique history entries', () => {
    const entry: HttpRequestHistoryEntry = {
      timestamp: 1,
      url: 'https://a.test',
      method: 'GET',
      codeFormat: 'fetch'
    };
    expect(prependHttpRequestHistory([entry], entry)).toHaveLength(1);
    expect(prependHttpRequestHistory([], { ...entry, method: 'POST' })).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveHttpRequestSuggestion({
        url: 'https://a.test',
        method: 'GET',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: '',
        hasCopiedCode: false
      })
    ).toBeNull();

    expect(
      resolveHttpRequestSuggestion({
        url: 'https://a.test',
        method: 'GET',
        headers: [{ key: 'Authorization', value: 'Bearer abc.def' }],
        body: '',
        hasCopiedCode: false
      })?.id
    ).toBe('hrg-jwt');

    expect(
      resolveHttpRequestSuggestion({
        url: 'https://a.test',
        method: 'GET',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: '',
        hasCopiedCode: true
      })?.id
    ).toBe('hrg-cors');
  });
});
