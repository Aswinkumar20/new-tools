import { addLineNumbers, removeLineNumbers } from '../shared/text-transform.utils';
import {
  clampLineStartNumber,
  convertLineNumberText,
  countTextLines,
  inputLooksLikeNumberedLines,
  resolveLineNumberSuggestion
} from './line-number-tool.utils';

describe('line-number-tool.utils', () => {
  it('clamps start number to non-negative integers', () => {
    expect(clampLineStartNumber(-3.2)).toBe(0);
    expect(clampLineStartNumber(undefined)).toBe(1);
    expect(clampLineStartNumber(4.6)).toBe(5);
  });

  it('counts lines including trailing empty segments', () => {
    expect(countTextLines('')).toBe(0);
    expect(countTextLines('a\nb')).toBe(2);
    expect(countTextLines('a\n')).toBe(2);
  });

  it('adds and removes line numbers via shared transforms', () => {
    const text = 'alpha\nbeta';
    const added = convertLineNumberText({
      mode: 'add',
      inputText: text,
      startNumber: 1,
      separator: '. '
    });
    expect(added.output).toBe(addLineNumbers(text, 1, '. '));
    expect(added.output).toBe('1. alpha\n2. beta');

    const removed = convertLineNumberText({
      mode: 'remove',
      inputText: added.output,
      startNumber: 1,
      separator: '. '
    });
    expect(removed.output).toBe(removeLineNumbers(added.output));
    expect(removed.output).toBe('alpha\nbeta');
  });

  it('detects numbered-looking input', () => {
    expect(inputLooksLikeNumberedLines('1. a\n2. b\n3. c')).toBe(true);
    expect(inputLooksLikeNumberedLines('a\nb\nc')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveLineNumberSuggestion({
        mode: 'add',
        hasInput: false,
        hasOutput: false,
        lineCount: 0,
        inputLooksNumbered: false
      })?.id
    ).toBe('lnt-get-started');

    expect(
      resolveLineNumberSuggestion({
        mode: 'add',
        hasInput: true,
        hasOutput: true,
        lineCount: 3,
        inputLooksNumbered: true
      })?.id
    ).toBe('lnt-already-numbered');

    expect(
      resolveLineNumberSuggestion({
        mode: 'remove',
        hasInput: true,
        hasOutput: true,
        lineCount: 2,
        inputLooksNumbered: false
      })?.id
    ).toBe('lnt-not-numbered');

    expect(
      resolveLineNumberSuggestion({
        mode: 'add',
        hasInput: true,
        hasOutput: true,
        lineCount: 2,
        inputLooksNumbered: false
      })?.id
    ).toBe('lnt-added');

    expect(
      resolveLineNumberSuggestion({
        mode: 'remove',
        hasInput: true,
        hasOutput: true,
        lineCount: 2,
        inputLooksNumbered: true
      })?.id
    ).toBe('lnt-removed');
  });
});
