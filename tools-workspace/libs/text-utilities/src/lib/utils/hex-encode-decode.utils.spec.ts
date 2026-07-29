import {
  convertHexText,
  inputLooksLikeHex,
  resolveHexSuggestion,
  separatorCharForHexOption
} from './hex-encode-decode.utils';
import { hexEncode, hexDecode } from '../shared/text-transform.utils';

describe('hex-encode-decode.utils', () => {
  it('maps separator options to characters', () => {
    expect(separatorCharForHexOption('none')).toBe('');
    expect(separatorCharForHexOption('space')).toBe(' ');
    expect(separatorCharForHexOption('colon')).toBe(':');
  });

  it('encodes text to spaced hex', () => {
    const result = convertHexText({
      mode: 'encode',
      inputText: 'hi',
      separator: 'space'
    });
    expect(result.errorMessage).toBe('');
    expect(result.output).toBe('68 69');
    expect(result.output).toBe(hexEncode('hi', ' '));
  });

  it('decodes hex with separators', () => {
    const result = convertHexText({
      mode: 'decode',
      inputText: '68:69',
      separator: 'colon'
    });
    expect(result).toEqual({ output: 'hi', errorMessage: '' });
    expect(hexDecode('68:69')).toBe('hi');
  });

  it('reports odd-length hex errors', () => {
    const result = convertHexText({
      mode: 'decode',
      inputText: '686',
      separator: 'none'
    });
    expect(result.output).toBe('');
    expect(result.errorMessage).toContain('Invalid hex string length');
  });

  it('detects hex-shaped input', () => {
    expect(inputLooksLikeHex('68 69 6f')).toBe(true);
    expect(inputLooksLikeHex('hello')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveHexSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        errorMessage: '',
        inputLooksLikeHex: false
      })?.id
    ).toBe('hex-get-started');

    expect(
      resolveHexSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: false,
        errorMessage: 'Invalid hex string length.',
        inputLooksLikeHex: true
      })?.id
    ).toBe('hex-error');

    expect(
      resolveHexSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeHex: true
      })?.id
    ).toBe('hex-looks-hex');

    expect(
      resolveHexSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeHex: false
      })?.id
    ).toBe('hex-encoded');
  });
});
