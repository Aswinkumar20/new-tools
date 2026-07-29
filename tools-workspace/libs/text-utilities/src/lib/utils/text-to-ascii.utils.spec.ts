import {
  asciiCodesToText,
  binaryCodesToText,
  convertTextToAsciiFormats,
  hexCodesToText,
  inputLooksLikeAsciiCodes,
  inputLooksLikeBinaryCodes,
  inputLooksLikeHexCodes,
  resolveTextToAsciiSuggestion,
  textToAsciiCodes,
  textToBinaryCodes,
  textToHexCodes,
} from './text-to-ascii.utils';

describe('text-to-ascii.utils', () => {
  it('encodes and decodes ASCII codes', () => {
    expect(textToAsciiCodes('Hi')).toBe('72 105');
    expect(asciiCodesToText('72 105')).toBe('Hi');
  });

  it('encodes and decodes binary', () => {
    const binary = textToBinaryCodes('A');
    expect(binary).toBe('01000001');
    expect(binaryCodesToText(binary)).toBe('A');
  });

  it('encodes and decodes hex', () => {
    expect(textToHexCodes('Hi')).toBe('48 69');
    expect(hexCodesToText('48 69')).toBe('Hi');
  });

  it('converts text to ascii via convertTextToAsciiFormats', () => {
    expect(
      convertTextToAsciiFormats({
        input: 'Hi',
        leftType: 'text',
        rightType: 'ascii',
      }).output
    ).toBe('72 105');
  });

  it('returns trimmed input when formats match', () => {
    expect(
      convertTextToAsciiFormats({
        input: '  hello  ',
        leftType: 'text',
        rightType: 'text',
      }).output
    ).toBe('hello');
  });

  it('throws on invalid ascii input', () => {
    expect(() => asciiCodesToText('72 hello')).toThrow(/only numbers/);
  });

  it('detects code-looking inputs', () => {
    expect(inputLooksLikeAsciiCodes('72 105')).toBe(true);
    expect(inputLooksLikeBinaryCodes('01001000 01100101')).toBe(true);
    expect(inputLooksLikeHexCodes('48 65 6C')).toBe(true);
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveTextToAsciiSuggestion({
        hasInput: false,
        hasOutput: false,
        hasError: false,
        leftType: 'text',
        rightType: 'ascii',
        inputLooksLikeAscii: false,
        inputLooksLikeBinary: false,
        inputLooksLikeHex: false,
      })?.id
    ).toBe('tta-get-started');
  });

  it('suggests format-error when conversion failed', () => {
    expect(
      resolveTextToAsciiSuggestion({
        hasInput: true,
        hasOutput: false,
        hasError: true,
        leftType: 'ascii',
        rightType: 'text',
        inputLooksLikeAscii: false,
        inputLooksLikeBinary: false,
        inputLooksLikeHex: false,
      })?.id
    ).toBe('tta-format-error');
  });

  it('prefers binary detection over ascii for 0/1 groups', () => {
    expect(
      resolveTextToAsciiSuggestion({
        hasInput: true,
        hasOutput: false,
        hasError: false,
        leftType: 'text',
        rightType: 'ascii',
        inputLooksLikeAscii: true,
        inputLooksLikeBinary: true,
        inputLooksLikeHex: true,
      })?.id
    ).toBe('tta-maybe-binary-input');
  });
});
