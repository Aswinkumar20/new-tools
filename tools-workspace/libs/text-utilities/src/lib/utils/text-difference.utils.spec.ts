import {
  clampDiffFontSize,
  computeDiffStats,
  isLikelyDiffTextFile,
  normalizeDiffLanguage,
  resolveTextDifferenceSuggestion,
} from './text-difference.utils';

describe('text-difference.utils', () => {
  it('computes diff stats', () => {
    const stats = computeDiffStats('abc', 'abcd', 2);
    expect(stats.originalChars).toBe(3);
    expect(stats.modifiedChars).toBe(4);
    expect(stats.originalLines).toBe(1);
    expect(stats.modifiedLines).toBe(1);
    expect(stats.changes).toBe(2);
    expect(stats.hasContent).toBe(true);
  });

  it('clamps font size', () => {
    expect(clampDiffFontSize(7)).toBeNull();
    expect(clampDiffFontSize(33)).toBeNull();
    expect(clampDiffFontSize(14)).toBe(14);
  });

  it('normalizes language', () => {
    expect(normalizeDiffLanguage('text/plain')).toBe('plaintext');
    expect(normalizeDiffLanguage('typescript')).toBe('typescript');
  });

  it('detects likely text files', () => {
    expect(isLikelyDiffTextFile(new File(['hi'], 'a.txt', { type: 'text/plain' }))).toBe(true);
    expect(isLikelyDiffTextFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(false);
  });

  it('suggests get-started when both empty', () => {
    expect(
      resolveTextDifferenceSuggestion({
        hasOriginal: false,
        hasModified: false,
        areIdentical: true,
        changeCount: 0,
        ignoreTrimWhitespace: false,
        charDelta: 0,
      })?.id
    ).toBe('td-get-started');
  });

  it('suggests when sides are identical', () => {
    expect(
      resolveTextDifferenceSuggestion({
        hasOriginal: true,
        hasModified: true,
        areIdentical: true,
        changeCount: 0,
        ignoreTrimWhitespace: false,
        charDelta: 0,
      })?.id
    ).toBe('td-identical');
  });

  it('suggests when one side is empty', () => {
    expect(
      resolveTextDifferenceSuggestion({
        hasOriginal: true,
        hasModified: false,
        areIdentical: false,
        changeCount: 0,
        ignoreTrimWhitespace: false,
        charDelta: 10,
      })?.id
    ).toBe('td-one-side-empty');
  });

  it('suggests code merge for many changes', () => {
    expect(
      resolveTextDifferenceSuggestion({
        hasOriginal: true,
        hasModified: true,
        areIdentical: false,
        changeCount: 8,
        ignoreTrimWhitespace: true,
        charDelta: 40,
      })?.id
    ).toBe('td-many-changes');
  });
});
