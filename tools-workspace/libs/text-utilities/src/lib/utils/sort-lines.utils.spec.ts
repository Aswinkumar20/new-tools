import {
  convertSortLinesText,
  countSortLines,
  inputHasDuplicateLines,
  inputLooksMostlyNumeric,
  resolveSortLinesSuggestion,
} from './sort-lines.utils';

describe('sort-lines.utils', () => {
  it('sorts alphabetically A→Z', () => {
    expect(
      convertSortLinesText({
        inputText: 'c\na\nb',
        sortMode: 'az',
        caseSensitive: false,
      }).output
    ).toBe('a\nb\nc');
  });

  it('sorts Z→A', () => {
    expect(
      convertSortLinesText({
        inputText: 'a\nb\nc',
        sortMode: 'za',
        caseSensitive: false,
      }).output
    ).toBe('c\nb\na');
  });

  it('sorts by length ascending', () => {
    expect(
      convertSortLinesText({
        inputText: 'bbb\na\ncc',
        sortMode: 'length-asc',
        caseSensitive: false,
      }).output
    ).toBe('a\ncc\nbbb');
  });

  it('sorts numerically', () => {
    expect(
      convertSortLinesText({
        inputText: '10\n2\n1',
        sortMode: 'numeric',
        caseSensitive: false,
      }).output
    ).toBe('1\n2\n10');
  });

  it('counts lines', () => {
    expect(countSortLines('')).toBe(0);
    expect(countSortLines('a\nb')).toBe(2);
  });

  it('detects mostly numeric lines', () => {
    expect(inputLooksMostlyNumeric('10 apples\n2 oranges\n1 pear')).toBe(true);
    expect(inputLooksMostlyNumeric('alpha\nbeta\ngamma')).toBe(false);
  });

  it('detects duplicate lines', () => {
    expect(inputHasDuplicateLines('a\nb\na')).toBe(true);
    expect(inputHasDuplicateLines('a\nb\nc')).toBe(false);
  });

  it('suggests get-started with empty input', () => {
    expect(
      resolveSortLinesSuggestion({
        hasInput: false,
        hasOutput: false,
        lineCount: 0,
        sortMode: 'az',
        caseSensitive: false,
        outputUnchanged: false,
        looksMostlyNumeric: false,
        hasDuplicateLines: false,
      })?.id
    ).toBe('sort-get-started');
  });

  it('suggests single-line tip', () => {
    expect(
      resolveSortLinesSuggestion({
        hasInput: true,
        hasOutput: true,
        lineCount: 1,
        sortMode: 'az',
        caseSensitive: false,
        outputUnchanged: true,
        looksMostlyNumeric: false,
        hasDuplicateLines: false,
      })?.id
    ).toBe('sort-single-line');
  });

  it('suggests numeric mode when lines look numeric', () => {
    expect(
      resolveSortLinesSuggestion({
        hasInput: true,
        hasOutput: true,
        lineCount: 3,
        sortMode: 'az',
        caseSensitive: false,
        outputUnchanged: false,
        looksMostlyNumeric: true,
        hasDuplicateLines: false,
      })?.id
    ).toBe('sort-looks-numeric');
  });

  it('suggests dedupe when duplicates exist', () => {
    expect(
      resolveSortLinesSuggestion({
        hasInput: true,
        hasOutput: true,
        lineCount: 3,
        sortMode: 'az',
        caseSensitive: false,
        outputUnchanged: false,
        looksMostlyNumeric: false,
        hasDuplicateLines: true,
      })?.id
    ).toBe('sort-has-duplicates');
  });

  it('suggests after successful sort', () => {
    expect(
      resolveSortLinesSuggestion({
        hasInput: true,
        hasOutput: true,
        lineCount: 3,
        sortMode: 'az',
        caseSensitive: false,
        outputUnchanged: false,
        looksMostlyNumeric: false,
        hasDuplicateLines: false,
      })?.id
    ).toBe('sort-sorted');
  });
});
