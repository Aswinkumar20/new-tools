import { jsonEscape, jsonUnescape } from '../shared/text-transform.utils';
import {
  convertJsonStringText,
  inputLooksLikeJsonEscaped,
  resolveJsonStringSuggestion
} from './json-string-escape-unescape.utils';

describe('json-string-escape-unescape.utils', () => {
  it('escapes JSON special characters', () => {
    const result = convertJsonStringText({
      mode: 'encode',
      inputText: 'line\n"quote"'
    });
    expect(result.errorMessage).toBe('');
    expect(result.output).toBe(jsonEscape('line\n"quote"'));
    expect(result.output).toContain('\\n');
    expect(result.output).toContain('\\"');
  });

  it('unescapes JSON sequences', () => {
    const escaped = jsonEscape('hello\tworld');
    const result = convertJsonStringText({ mode: 'decode', inputText: escaped });
    expect(result).toEqual({ output: 'hello\tworld', errorMessage: '' });
    expect(jsonUnescape(escaped)).toBe('hello\tworld');
  });

  it('reports invalid escape sequences', () => {
    const result = convertJsonStringText({
      mode: 'decode',
      inputText: 'bad\\q'
    });
    expect(result.output).toBe('');
    expect(result.errorMessage).toContain('Invalid JSON escape sequence');
  });

  it('rejects bare quotes when decoding', () => {
    const result = convertJsonStringText({
      mode: 'decode',
      inputText: 'has "quotes"'
    });
    expect(result.errorMessage).toContain('Invalid JSON escape sequence');
  });

  it('detects escaped-looking input', () => {
    expect(inputLooksLikeJsonEscaped('line\\nnext')).toBe(true);
    expect(inputLooksLikeJsonEscaped('\\u0041')).toBe(true);
    expect(inputLooksLikeJsonEscaped('plain text')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveJsonStringSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        errorMessage: '',
        inputLooksLikeEscaped: false
      })?.id
    ).toBe('jse-get-started');

    expect(
      resolveJsonStringSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: false,
        errorMessage: 'Invalid JSON escape sequence.',
        inputLooksLikeEscaped: false
      })?.id
    ).toBe('jse-error');

    expect(
      resolveJsonStringSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeEscaped: true
      })?.id
    ).toBe('jse-looks-escaped');

    expect(
      resolveJsonStringSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeEscaped: false
      })?.id
    ).toBe('jse-escaped');

    expect(
      resolveJsonStringSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        inputLooksLikeEscaped: true
      })?.id
    ).toBe('jse-unescaped');
  });
});
