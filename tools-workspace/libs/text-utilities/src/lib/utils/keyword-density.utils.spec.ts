import { keywordDensity } from '../shared/text-transform.utils';
import {
  clampKeywordTopN,
  computeKeywordDensityAnalysis,
  formatKeywordDensityTable,
  resolveKeywordDensitySuggestion
} from './keyword-density.utils';

describe('keyword-density.utils', () => {
  it('clamps Top N into 1–100', () => {
    expect(clampKeywordTopN(0)).toBe(20);
    expect(clampKeywordTopN(50.6)).toBe(51);
    expect(clampKeywordTopN(200)).toBe(100);
    expect(clampKeywordTopN(-5)).toBe(1);
  });

  it('computes density matching shared keywordDensity', () => {
    const text = 'hello hello world';
    const result = computeKeywordDensityAnalysis({
      inputText: text,
      topN: 20,
      excludeStopWords: true
    });
    expect(result.keywords).toEqual(keywordDensity(text, 20, true));
    expect(result.keywords[0]?.word).toBe('hello');
    expect(result.output).toContain('Density');
    expect(result.output).toContain('hello');
  });

  it('formats an empty table as empty string', () => {
    expect(formatKeywordDensityTable([])).toBe('');
  });

  it('returns empty analysis for empty input', () => {
    expect(
      computeKeywordDensityAnalysis({
        inputText: '',
        topN: 20,
        excludeStopWords: true
      })
    ).toEqual({ keywords: [], output: '' });
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveKeywordDensitySuggestion({
        hasInput: false,
        keywordCount: 0,
        excludeStopWords: true,
        topDensity: 0,
        topWord: ''
      })?.id
    ).toBe('kd-get-started');

    expect(
      resolveKeywordDensitySuggestion({
        hasInput: true,
        keywordCount: 0,
        excludeStopWords: true,
        topDensity: 0,
        topWord: ''
      })?.id
    ).toBe('kd-none');

    expect(
      resolveKeywordDensitySuggestion({
        hasInput: true,
        keywordCount: 5,
        excludeStopWords: false,
        topDensity: 12,
        topWord: 'the'
      })?.id
    ).toBe('kd-stop-words');

    expect(
      resolveKeywordDensitySuggestion({
        hasInput: true,
        keywordCount: 5,
        excludeStopWords: true,
        topDensity: 8,
        topWord: 'seo'
      })?.id
    ).toBe('kd-high-density');

    expect(
      resolveKeywordDensitySuggestion({
        hasInput: true,
        keywordCount: 3,
        excludeStopWords: true,
        topDensity: 2,
        topWord: 'tools'
      })?.id
    ).toBe('kd-ready');
  });
});
