import { textToMorse, morseToText } from '../shared/text-transform.utils';
import {
  convertMorseText,
  inputLooksLikeMorse,
  resolveMorseSuggestion
} from './morse-code-converter.utils';

describe('morse-code-converter.utils', () => {
  it('encodes text to Morse matching shared textToMorse', () => {
    const result = convertMorseText({ mode: 'encode', inputText: 'SOS' });
    expect(result.output).toBe(textToMorse('SOS'));
    expect(result.output).toContain('...');
  });

  it('decodes Morse to text matching shared morseToText', () => {
    const morse = textToMorse('HI');
    const result = convertMorseText({ mode: 'decode', inputText: morse });
    expect(result.output).toBe(morseToText(morse));
    expect(result.output).toBe('HI');
  });

  it('returns empty output for empty input', () => {
    expect(convertMorseText({ mode: 'encode', inputText: '' })).toEqual({ output: '' });
  });

  it('detects Morse-shaped input', () => {
    expect(inputLooksLikeMorse('... --- ...')).toBe(true);
    expect(inputLooksLikeMorse('hello world')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveMorseSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        inputLooksLikeMorse: false
      })?.id
    ).toBe('morse-get-started');

    expect(
      resolveMorseSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeMorse: true
      })?.id
    ).toBe('morse-looks-morse');

    expect(
      resolveMorseSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeMorse: false
      })?.id
    ).toBe('morse-not-morse');

    expect(
      resolveMorseSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeMorse: false
      })?.id
    ).toBe('morse-encoded');

    expect(
      resolveMorseSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: true,
        inputLooksLikeMorse: true
      })?.id
    ).toBe('morse-decoded');
  });
});
