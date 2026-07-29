import {
  annotateInvisibleChars,
  detectInvisibleChars
} from '../shared/text-transform.utils';
import {
  detectAndAnnotateInvisibleChars,
  formatInvisibleCodePoint,
  resolveInvisibleCharacterSuggestion,
  summarizeInvisibleHits
} from './invisible-character-detector.utils';

describe('invisible-character-detector.utils', () => {
  it('detects and annotates zero-width space', () => {
    const input = `a\u200bb`;
    const result = detectAndAnnotateInvisibleChars(input);
    expect(result.hits).toEqual(detectInvisibleChars(input));
    expect(result.hits).toHaveLength(1);
    expect(result.output).toBe(annotateInvisibleChars(input, result.hits));
    expect(result.output).toContain('[ZERO WIDTH SPACE]');
  });

  it('returns empty output when no invisible characters exist', () => {
    expect(detectAndAnnotateInvisibleChars('plain text')).toEqual({ hits: [], output: '' });
  });

  it('returns empty result for empty input', () => {
    expect(detectAndAnnotateInvisibleChars('')).toEqual({ hits: [], output: '' });
  });

  it('summarizes hit categories', () => {
    const zwsp = detectInvisibleChars(`x\u200by`);
    expect(summarizeInvisibleHits(zwsp)).toEqual({
      hitCount: 1,
      hasZeroWidth: true,
      hasBom: false,
      hasNbspOrSoftHyphen: false
    });

    const bom = detectInvisibleChars(`\ufeffhi`);
    expect(summarizeInvisibleHits(bom).hasBom).toBe(true);
    expect(summarizeInvisibleHits(bom).hasZeroWidth).toBe(true);

    const nbsp = detectInvisibleChars(`a\u00a0b`);
    expect(summarizeInvisibleHits(nbsp).hasNbspOrSoftHyphen).toBe(true);
  });

  it('formats code points', () => {
    expect(formatInvisibleCodePoint(0x200b)).toBe('U+200B');
    expect(formatInvisibleCodePoint(0xa0)).toBe('U+00A0');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: false,
        hitCount: 0,
        hasZeroWidth: false,
        hasBom: false,
        hasNbspOrSoftHyphen: false
      })?.id
    ).toBe('icd-get-started');

    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: true,
        hitCount: 0,
        hasZeroWidth: false,
        hasBom: false,
        hasNbspOrSoftHyphen: false
      })?.id
    ).toBe('icd-clean');

    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: true,
        hitCount: 1,
        hasZeroWidth: true,
        hasBom: true,
        hasNbspOrSoftHyphen: false
      })?.id
    ).toBe('icd-bom');

    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: true,
        hitCount: 2,
        hasZeroWidth: true,
        hasBom: false,
        hasNbspOrSoftHyphen: false
      })?.id
    ).toBe('icd-zero-width');

    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: true,
        hitCount: 1,
        hasZeroWidth: false,
        hasBom: false,
        hasNbspOrSoftHyphen: true
      })?.id
    ).toBe('icd-nbsp');

    expect(
      resolveInvisibleCharacterSuggestion({
        hasInput: true,
        hitCount: 3,
        hasZeroWidth: false,
        hasBom: false,
        hasNbspOrSoftHyphen: false
      })?.id
    ).toBe('icd-found');
  });
});
