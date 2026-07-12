import {
  urlEncode,
  urlDecode,
  unicodeEscape,
  unicodeUnescape,
  sortLines,
  trimNormalize,
  findReplace,
  levenshteinDistance,
  similarityPercent,
  jsonEscape,
  jsonUnescape,
  hexEncode,
  hexDecode,
  rot13,
  findReplace,
  stripHtmlTags,
} from './text-transform.utils';

describe('text-transform.utils', () => {
  it('url encodes and decodes', () => {
    const encoded = urlEncode('hello world!', 'component', false);
    expect(encoded).toBe('hello%20world!');
    expect(urlDecode(encoded, false)).toBe('hello world!');
  });

  it('unicode escapes and unescapes', () => {
    const escaped = unicodeEscape('A\u20AC');
    expect(unicodeUnescape(escaped)).toBe('A\u20AC');
  });

  it('sorts lines', () => {
    expect(sortLines('b\na\nc', 'az', true)).toBe('a\nb\nc');
  });

  it('trims and normalizes', () => {
    expect(
      trimNormalize('  hello   \n\n  world  ', {
        trimLines: true,
        collapseSpaces: true,
        removeEmptyLines: true,
        normalizeLineEndings: true,
      }),
    ).toBe('hello\nworld');
  });

  it('finds and replaces', () => {
    expect(findReplace('foo bar foo', 'foo', 'baz', { useRegex: false, caseSensitive: true, replaceAll: true })).toBe(
      'baz bar baz',
    );
  });

  it('computes similarity', () => {
    expect(similarityPercent('kitten', 'sitting')).toBeGreaterThan(0);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('json escapes and unescapes', () => {
    const escaped = jsonEscape('line\n"quote"');
    expect(jsonUnescape(escaped)).toBe('line\n"quote"');
  });

  it('hex encodes and decodes', () => {
    const hex = hexEncode('hi', ' ');
    expect(hexDecode(hex)).toBe('hi');
  });

  it('rot13 is self-inverse', () => {
    expect(rot13(rot13('Hello'))).toBe('Hello');
  });

  it('strips html tags', () => {
    expect(stripHtmlTags('<p>Hello <b>world</b></p>', false)).toBe('Hello world');
  });

  it('throws on invalid regex in findReplace', () => {
    expect(() =>
      findReplace('test', '[', 'x', { useRegex: true, caseSensitive: false, replaceAll: true }),
    ).toThrow(/Invalid regex/);
  });
});
