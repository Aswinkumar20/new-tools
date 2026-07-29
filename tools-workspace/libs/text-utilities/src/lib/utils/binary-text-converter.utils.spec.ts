import {
  convertBinaryText,
  inputLooksLikeBinary,
  resolveBinaryTextSuggestion,
  separatorCharForOption
} from './binary-text-converter.utils';
import { textToBinary, binaryToText } from '../shared/text-transform.utils';

describe('binary-text-converter.utils', () => {
  it('maps separator options to characters', () => {
    expect(separatorCharForOption('none')).toBe('');
    expect(separatorCharForOption('space')).toBe(' ');
    expect(separatorCharForOption('colon')).toBe(':');
  });

  it('encodes text to spaced 8-bit binary', () => {
    const result = convertBinaryText({
      mode: 'encode',
      inputText: 'A',
      separator: 'space',
      bits: 8
    });
    expect(result.errorMessage).toBe('');
    expect(result.output).toBe('01000001');
    expect(result.output).toBe(textToBinary('A', ' ', 8));
  });

  it('decodes binary back to text', () => {
    const result = convertBinaryText({
      mode: 'decode',
      inputText: '01000001 01000010',
      separator: 'space',
      bits: 8
    });
    expect(result).toEqual({ output: 'AB', errorMessage: '' });
    expect(binaryToText('01000001 01000010', 8)).toBe('AB');
  });

  it('reports length errors for decode', () => {
    const result = convertBinaryText({
      mode: 'decode',
      inputText: '0100000',
      separator: 'none',
      bits: 8
    });
    expect(result.output).toBe('');
    expect(result.errorMessage).toContain('multiple of 8');
  });

  it('detects binary-shaped input', () => {
    expect(inputLooksLikeBinary('01000001 01000010', 8)).toBe(true);
    expect(inputLooksLikeBinary('hello', 8)).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveBinaryTextSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        errorMessage: '',
        bits: 8,
        inputLooksLikeBinary: false
      })?.id
    ).toBe('btc-get-started');

    expect(
      resolveBinaryTextSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: false,
        errorMessage: 'Binary length must be a multiple of 8.',
        bits: 8,
        inputLooksLikeBinary: true
      })?.id
    ).toBe('btc-length');

    expect(
      resolveBinaryTextSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        bits: 8,
        inputLooksLikeBinary: true
      })?.id
    ).toBe('btc-looks-binary');

    expect(
      resolveBinaryTextSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        bits: 8,
        inputLooksLikeBinary: false
      })?.id
    ).toBe('btc-encoded');
  });
});
