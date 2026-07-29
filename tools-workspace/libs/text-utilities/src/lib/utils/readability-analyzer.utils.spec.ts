import { analyzeReadability } from '../shared/text-transform.utils';
import {
  computeReadabilityAnalysis,
  formatReadabilityReport,
  resolveReadabilitySuggestion
} from './readability-analyzer.utils';

describe('readability-analyzer.utils', () => {
  const sample = 'The quick brown fox jumps over the lazy dog.';

  it('computes analysis matching shared analyzeReadability', () => {
    const result = computeReadabilityAnalysis(sample);
    expect(result.readability).toEqual(analyzeReadability(sample));
    expect(result.readability?.words).toBeGreaterThan(0);
    expect(result.output).toContain('Flesch Reading Ease');
    expect(result.output).toContain('Reading Level:');
  });

  it('returns empty report when there are no words', () => {
    const result = computeReadabilityAnalysis('!!!');
    expect(result.readability?.words).toBe(0);
    expect(result.output).toBe('');
    expect(formatReadabilityReport(result.readability!)).toBe('');
  });

  it('returns null readability for empty input', () => {
    expect(computeReadabilityAnalysis('')).toEqual({ readability: null, output: '' });
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveReadabilitySuggestion({
        hasInput: false,
        wordCount: 0,
        fleschReadingEase: 0,
        readingLevel: 'N/A'
      })?.id
    ).toBe('ra-get-started');

    expect(
      resolveReadabilitySuggestion({
        hasInput: true,
        wordCount: 0,
        fleschReadingEase: 0,
        readingLevel: 'N/A'
      })?.id
    ).toBe('ra-no-words');

    expect(
      resolveReadabilitySuggestion({
        hasInput: true,
        wordCount: 40,
        fleschReadingEase: 25,
        readingLevel: 'Very Difficult (College graduate)'
      })?.id
    ).toBe('ra-difficult');

    expect(
      resolveReadabilitySuggestion({
        hasInput: true,
        wordCount: 20,
        fleschReadingEase: 85,
        readingLevel: 'Easy (6th grade)'
      })?.id
    ).toBe('ra-easy');

    expect(
      resolveReadabilitySuggestion({
        hasInput: true,
        wordCount: 30,
        fleschReadingEase: 62,
        readingLevel: 'Standard (8th–9th grade)'
      })?.id
    ).toBe('ra-ready');
  });
});
