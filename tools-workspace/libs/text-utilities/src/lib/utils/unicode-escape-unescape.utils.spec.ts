import {
  convertUnicodeEscapeText,
  inputHasNonAsciiCharacters,
  inputLooksLikeUnicodeEscaped,
  resolveUnicodeEscapeSuggestion,
} from './unicode-escape-unescape.utils';

describe('unicode-escape-unescape.utils', () => {
  it('escapes non-ascii characters', () => {
    expect(convertUnicodeEscapeText({ mode: 'encode', inputText: '€' }).output).toBe('\\u20AC');
  });

  it('escapes astral plane with braces', () => {
    const grin = String.fromCodePoint(0x1f600);
    expect(convertUnicodeEscapeText({ mode: 'encode', inputText: grin }).output).toBe('\\u{1F600}');
  });

  it('unescapes \\uXXXX sequences', () => {
    expect(convertUnicodeEscapeText({ mode: 'decode', inputText: '\\u20AC' }).output).toBe('€');
  });

  it('detects escaped and non-ascii input', () => {
    expect(inputLooksLikeUnicodeEscaped('price \\u20AC')).toBe(true);
    expect(inputLooksLikeUnicodeEscaped('plain')).toBe(false);
    expect(inputHasNonAsciiCharacters('€')).toBe(true);
    expect(inputHasNonAsciiCharacters('Hi')).toBe(false);
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveUnicodeEscapeSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        inputLooksLikeEscaped: false,
        inputHasNonAscii: false,
        outputUnchanged: false,
      })?.id
    ).toBe('ueu-get-started');
  });

  it('suggests switch to decode when encode input looks escaped', () => {
    expect(
      resolveUnicodeEscapeSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeEscaped: true,
        inputHasNonAscii: false,
        outputUnchanged: false,
      })?.id
    ).toBe('ueu-looks-escaped');
  });

  it('suggests encoded when escape succeeds', () => {
    expect(
      resolveUnicodeEscapeSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeEscaped: false,
        inputHasNonAscii: true,
        outputUnchanged: false,
      })?.id
    ).toBe('ueu-encoded');
  });
});
