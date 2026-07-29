import {
  COOKIE_VALUE_PREVIEW_MAX_LENGTH
} from '../constants/cookie-editor.constants';
import {
  buildCookieDeleteString,
  buildCookieSetString,
  filterCookieEntries,
  formatCookieValuePreview,
  looksLikeBase64,
  looksLikeJwt,
  parseDocumentCookies,
  resolveCookieSuggestion,
  serializeAllCookies,
  serializeCookieLine
} from './cookie-editor.utils';

describe('cookie-editor.utils', () => {
  it('parses document cookies and tolerates malformed decoding', () => {
    expect(parseDocumentCookies('')).toEqual([]);
    expect(parseDocumentCookies('a=1; b=two%20words')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: 'two words' }
    ]);
    expect(parseDocumentCookies('bad=%E0%A4%A')).toEqual([{ name: 'bad', value: '%E0%A4%A' }]);
  });

  it('filters cookie entries by name or value', () => {
    const entries = [
      { name: 'session', value: 'abc' },
      { name: 'theme', value: 'dark' }
    ];
    expect(filterCookieEntries(entries, '')).toEqual(entries);
    expect(filterCookieEntries(entries, 'THEME')).toEqual([{ name: 'theme', value: 'dark' }]);
    expect(filterCookieEntries(entries, 'abc')).toEqual([{ name: 'session', value: 'abc' }]);
  });

  it('formats long cookie values for preview', () => {
    const longValue = 'x'.repeat(COOKIE_VALUE_PREVIEW_MAX_LENGTH + 5);
    expect(formatCookieValuePreview(longValue).endsWith('...')).toBe(true);
    expect(formatCookieValuePreview('short')).toBe('short');
  });

  it('builds set and delete cookie strings', () => {
    const setString = buildCookieSetString({
      name: 'token',
      value: 'a b',
      domain: 'example.com',
      path: '/',
      daysToExpire: 1,
      secure: true,
      sameSite: 'None'
    });
    expect(setString).toContain('token=a%20b');
    expect(setString).toContain('Domain=example.com');
    expect(setString).toContain('Path=/');
    expect(setString).toContain('Secure');
    expect(setString).toContain('SameSite=None');
    expect(setString).toContain('Expires=');

    const sessionString = buildCookieSetString({
      name: 's',
      value: '1',
      domain: '',
      path: '/',
      daysToExpire: 0,
      secure: false,
      sameSite: 'Lax'
    });
    expect(sessionString).not.toContain('Expires=');

    expect(buildCookieDeleteString('token', '/', 'example.com')).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    );
  });

  it('serializes cookie lines', () => {
    expect(serializeCookieLine({ name: 'a', value: '1' })).toBe('a=1');
    expect(serializeAllCookies([{ name: 'a', value: '1' }, { name: 'b', value: '2' }])).toBe(
      'a=1\nb=2'
    );
  });

  it('detects jwt and base64 shaped values', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
    expect(looksLikeJwt(jwt)).toBe(true);
    expect(looksLikeBase64('SGVsbG9Xb3JsZCE=')).toBe(true);
    expect(looksLikeJwt('plain-text')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
    expect(
      resolveCookieSuggestion({ sameSite: 'Lax', secure: false, value: jwt }, 1)?.path
    ).toBe('/testing-tools/jwt-decoder');
    expect(
      resolveCookieSuggestion({ sameSite: 'Lax', secure: false, value: '' }, 0)?.path
    ).toBe('/browser-utils/storage-viewer');
    expect(
      resolveCookieSuggestion({ sameSite: 'Lax', secure: false, value: 'plain' }, 2)?.path
    ).toBe('/browser-utils/storage-viewer');
  });
});
