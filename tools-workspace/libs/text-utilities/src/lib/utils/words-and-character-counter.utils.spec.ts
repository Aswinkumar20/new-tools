import {
  calculateWordFrequency,
  countCharsNoSpaces,
  countSyllables,
  formatCompactCount,
  formatCountTitle,
  interpretReadabilityScore,
  resolveWccSuggestion,
} from './words-and-character-counter.utils';

describe('words-and-character-counter.utils', () => {
  it('counts characters excluding spaces', () => {
    expect(countCharsNoSpaces('a b\nc')).toBe(3);
  });

  it('computes word frequency', () => {
    expect(calculateWordFrequency(['Hello', 'hello', 'world'])).toEqual([
      { word: 'hello', count: 2 },
      { word: 'world', count: 1 },
    ]);
  });

  it('counts syllables', () => {
    expect(countSyllables(['hello', 'world'])).toBeGreaterThan(0);
  });

  it('interprets flesch scores', () => {
    expect(interpretReadabilityScore(95)).toBe('Very Easy');
    expect(interpretReadabilityScore(10)).toBe('Very Difficult');
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveWccSuggestion({
        hasContent: false,
        wordCount: 0,
        sentenceCount: 0,
        readabilityScore: 0,
        uniqueWordCount: 0,
        excludeStopWords: false,
      })?.id
    ).toBe('wcc-get-started');
  });

  it('suggests difficult readability', () => {
    expect(
      resolveWccSuggestion({
        hasContent: true,
        wordCount: 40,
        sentenceCount: 2,
        readabilityScore: 35,
        uniqueWordCount: 30,
        excludeStopWords: false,
      })?.id
    ).toBe('wcc-difficult-read');
  });

  it('formats compact counts with K, L, and Cr', () => {
    expect(formatCompactCount(9999)).toBe('9,999');
    expect(formatCompactCount(15000)).toBe('15K');
    expect(formatCompactCount(100000)).toBe('1 L');
    expect(formatCompactCount(2500000)).toBe('25 L');
    expect(formatCompactCount(10000000)).toBe('1 Cr');
    expect(formatCountTitle(100000)).toBe('1,00,000');
  });
});
