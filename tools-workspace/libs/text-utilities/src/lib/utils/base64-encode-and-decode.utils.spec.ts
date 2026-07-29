import {
  BASE64_DECODE_ERROR,
  BASE64_ENCODE_ERROR
} from '../constants/base64-encode-and-decode.constants';
import {
  convertBase64,
  inputLooksLikeBase64,
  isLikelyBase64TextFile,
  resolveBase64Suggestion,
  utf8ToBase64,
  base64ToUtf8
} from './base64-encode-and-decode.utils';

describe('base64-encode-and-decode.utils', () => {
  it('encodes and decodes UTF-8 round-trip', () => {
    const encoded = utf8ToBase64('café');
    expect(encoded).toBeTruthy();
    expect(base64ToUtf8(encoded)).toBe('café');
  });

  it('converts in encode and decode modes', () => {
    expect(convertBase64('encode', 'hello')).toEqual({
      output: 'aGVsbG8=',
      errorMessage: ''
    });
    expect(convertBase64('decode', 'aGVsbG8=')).toEqual({
      output: 'hello',
      errorMessage: ''
    });
  });

  it('returns decode error for invalid Base64', () => {
    expect(convertBase64('decode', 'not!!!base64')).toEqual({
      output: '',
      errorMessage: BASE64_DECODE_ERROR
    });
  });

  it('detects Base64-shaped input', () => {
    expect(inputLooksLikeBase64('aGVsbG8=')).toBe(true);
    expect(inputLooksLikeBase64('hello world')).toBe(false);
    expect(inputLooksLikeBase64('short')).toBe(false);
  });

  it('classifies likely text uploads', () => {
    expect(isLikelyBase64TextFile(new File(['x'], 'note.txt', { type: 'text/plain' }))).toBe(true);
    expect(isLikelyBase64TextFile(new File(['x'], 'data.b64', { type: '' }))).toBe(true);
    expect(isLikelyBase64TextFile(new File(['x'], 'pic.png', { type: 'image/png' }))).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveBase64Suggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        errorMessage: '',
        inputLooksLikeBase64: false
      })?.id
    ).toBe('b64-get-started');

    expect(
      resolveBase64Suggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: false,
        errorMessage: BASE64_DECODE_ERROR,
        inputLooksLikeBase64: false
      })?.id
    ).toBe('b64-invalid-decode');

    expect(
      resolveBase64Suggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeBase64: true
      })?.id
    ).toBe('b64-looks-encoded');

    expect(
      resolveBase64Suggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeBase64: false
      })?.id
    ).toBe('b64-encoded');

    expect(
      resolveBase64Suggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeBase64: true
      })?.id
    ).toBe('b64-decoded');

    expect(BASE64_ENCODE_ERROR).toContain('encoding');
  });
});
