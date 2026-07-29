import {
  analyzeTextReversal,
  normalizeForPalindrome,
  resolveTextReversalSuggestion,
  reverseString,
} from './text-reversal-and-palindrome-checker.utils';

describe('text-reversal-and-palindrome-checker.utils', () => {
  it('reverses strings', () => {
    expect(reverseString('drawer')).toBe('reward');
  });

  it('normalizes for palindrome checks', () => {
    expect(normalizeForPalindrome('Never odd or even')).toBe('neveroddoreven');
  });

  it('detects palindromes', () => {
    const result = analyzeTextReversal('Never odd or even', 'palindrome');
    expect(result.palindromeStatus).toBe(true);
    expect(result.resultText).toBe('');
  });

  it('rejects non-palindromes', () => {
    expect(analyzeTextReversal('Hello, world!', 'palindrome').palindromeStatus).toBe(false);
  });

  it('reverses in reverse mode', () => {
    const result = analyzeTextReversal('drawer', 'reverse');
    expect(result.resultText).toBe('reward');
    expect(result.palindromeStatus).toBeNull();
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveTextReversalSuggestion({
        mode: 'palindrome',
        hasInput: false,
        hasResult: false,
        palindromeStatus: null,
        normalizedLength: 0,
        inputEqualsReversed: false,
      })?.id
    ).toBe('trp-get-started');
  });

  it('suggests when palindrome is found', () => {
    expect(
      resolveTextReversalSuggestion({
        mode: 'palindrome',
        hasInput: true,
        hasResult: false,
        palindromeStatus: true,
        normalizedLength: 10,
        inputEqualsReversed: false,
      })?.id
    ).toBe('trp-is-palindrome');
  });

  it('suggests switch to palindrome when reverse equals input', () => {
    expect(
      resolveTextReversalSuggestion({
        mode: 'reverse',
        hasInput: true,
        hasResult: true,
        palindromeStatus: null,
        normalizedLength: 5,
        inputEqualsReversed: true,
      })?.id
    ).toBe('trp-self-reverse');
  });
});
