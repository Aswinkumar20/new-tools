import {
  computeTextSimilarity,
  resolveTextSimilaritySuggestion,
} from './text-similarity.utils';

describe('text-similarity.utils', () => {
  it('computes kitten/sitting similarity and report', () => {
    const result = computeTextSimilarity('kitten', 'sitting');
    expect(result.distance).toBe(3);
    expect(result.similarity).toBeGreaterThan(0);
    expect(result.similarity).toBeLessThan(100);
    expect(result.report).toContain('Similarity:');
    expect(result.report).toContain('Levenshtein distance: 3');
    expect(result.report).toContain('Text A length: 6 chars');
    expect(result.report).toContain('Text B length: 7 chars');
  });

  it('scores identical strings at 100%', () => {
    const result = computeTextSimilarity('abc', 'abc');
    expect(result.similarity).toBe(100);
    expect(result.distance).toBe(0);
  });

  it('scores two empty strings at 100%', () => {
    expect(computeTextSimilarity('', '').similarity).toBe(100);
  });

  it('suggests get-started when both empty', () => {
    expect(
      resolveTextSimilaritySuggestion({
        hasTextA: false,
        hasTextB: false,
        similarity: 0,
        distance: 0,
        lengthA: 0,
        lengthB: 0,
      })?.id
    ).toBe('tsim-get-started');
  });

  it('suggests need-both when only one side is filled', () => {
    expect(
      resolveTextSimilaritySuggestion({
        hasTextA: true,
        hasTextB: false,
        similarity: 0,
        distance: 5,
        lengthA: 5,
        lengthB: 0,
      })?.id
    ).toBe('tsim-need-both');
  });

  it('suggests identical at 100%', () => {
    expect(
      resolveTextSimilaritySuggestion({
        hasTextA: true,
        hasTextB: true,
        similarity: 100,
        distance: 0,
        lengthA: 3,
        lengthB: 3,
      })?.id
    ).toBe('tsim-identical');
  });

  it('suggests near-match for high similarity', () => {
    expect(
      resolveTextSimilaritySuggestion({
        hasTextA: true,
        hasTextB: true,
        similarity: 95,
        distance: 1,
        lengthA: 20,
        lengthB: 21,
      })?.id
    ).toBe('tsim-near-match');
  });

  it('suggests low-match for low similarity', () => {
    expect(
      resolveTextSimilaritySuggestion({
        hasTextA: true,
        hasTextB: true,
        similarity: 10,
        distance: 40,
        lengthA: 40,
        lengthB: 40,
      })?.id
    ).toBe('tsim-low-match');
  });
});
