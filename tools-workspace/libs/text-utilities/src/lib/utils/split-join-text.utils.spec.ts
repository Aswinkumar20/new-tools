import {
  convertSplitJoinText,
  countSplitParts,
  inputLooksLikeDelimitedList,
  inputLooksLikeLineList,
  resolveSplitJoinSuggestion,
} from './split-join-text.utils';

describe('split-join-text.utils', () => {
  it('splits by delimiter', () => {
    expect(
      convertSplitJoinText({ mode: 'split', inputText: 'a,b,c', delimiter: ',' }).output
    ).toBe('a\nb\nc');
  });

  it('joins lines with delimiter', () => {
    expect(
      convertSplitJoinText({ mode: 'join', inputText: 'a\nb\nc', delimiter: ', ' }).output
    ).toBe('a, b, c');
  });

  it('returns input unchanged when split delimiter is empty', () => {
    expect(
      convertSplitJoinText({ mode: 'split', inputText: 'a,b', delimiter: '' }).output
    ).toBe('a,b');
  });

  it('counts split parts', () => {
    expect(countSplitParts('a,b,c', ',')).toBe(3);
    expect(countSplitParts('', ',')).toBe(0);
  });

  it('detects line lists and delimited lists', () => {
    expect(inputLooksLikeLineList('a\nb\nc')).toBe(true);
    expect(inputLooksLikeDelimitedList('a,b,c', ',')).toBe(true);
    expect(inputLooksLikeDelimitedList('a\nb\nc', ',')).toBe(false);
  });

  it('suggests get-started with empty input', () => {
    expect(
      resolveSplitJoinSuggestion({
        mode: 'split',
        hasInput: false,
        hasOutput: false,
        delimiter: ',',
        outputUnchanged: false,
        looksLikeLineList: false,
        looksLikeDelimitedList: false,
        partCount: 0,
      })?.id
    ).toBe('sj-get-started');
  });

  it('suggests when delimiter is empty in split mode', () => {
    expect(
      resolveSplitJoinSuggestion({
        mode: 'split',
        hasInput: true,
        hasOutput: true,
        delimiter: '',
        outputUnchanged: true,
        looksLikeLineList: false,
        looksLikeDelimitedList: false,
        partCount: 1,
      })?.id
    ).toBe('sj-empty-delimiter');
  });

  it('suggests join when split input looks like lines', () => {
    expect(
      resolveSplitJoinSuggestion({
        mode: 'split',
        hasInput: true,
        hasOutput: true,
        delimiter: ',',
        outputUnchanged: true,
        looksLikeLineList: true,
        looksLikeDelimitedList: false,
        partCount: 1,
      })?.id
    ).toBe('sj-looks-lines');
  });

  it('suggests after successful split', () => {
    expect(
      resolveSplitJoinSuggestion({
        mode: 'split',
        hasInput: true,
        hasOutput: true,
        delimiter: ',',
        outputUnchanged: false,
        looksLikeLineList: false,
        looksLikeDelimitedList: true,
        partCount: 3,
      })?.id
    ).toBe('sj-split-done');
  });

  it('suggests after successful join', () => {
    expect(
      resolveSplitJoinSuggestion({
        mode: 'join',
        hasInput: true,
        hasOutput: true,
        delimiter: ',',
        outputUnchanged: false,
        looksLikeLineList: true,
        looksLikeDelimitedList: false,
        partCount: 3,
      })?.id
    ).toBe('sj-join-done');
  });
});
