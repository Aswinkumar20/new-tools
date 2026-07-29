import {
  DEFAULT_DEDUP_OPTIONS,
} from '../constants/remove-duplicate-lines.constants';
import {
  countExactDuplicateLines,
  deduplicateText,
  inputLooksLikeCsvRows,
  resolveRemoveDuplicateLinesSuggestion,
} from './remove-duplicate-lines.utils';

describe('remove-duplicate-lines.utils', () => {
  const base = { ...DEFAULT_DEDUP_OPTIONS };

  it('removes duplicate words case-insensitively', () => {
    const result = deduplicateText('the the quick brown', base);
    expect(result.output).toBe('the quick brown');
    expect(result.totalRemoved).toBe(1);
    expect(result.uniqueDuplicateKeys).toBe(1);
  });

  it('removes duplicate lines', () => {
    const result = deduplicateText('alpha\nbeta\nalpha', { ...base, mode: 'lines' });
    expect(result.output).toBe('alpha\nbeta');
    expect(result.totalRemoved).toBe(1);
  });

  it('dedupes by CSV first column', () => {
    const result = deduplicateText('a,1\nb,2\na,9', {
      ...base,
      mode: 'lines',
      csvMode: 'first-column',
    });
    expect(result.output).toBe('a,1\nb,2');
  });

  it('keeps last occurrence when configured', () => {
    const result = deduplicateText('foo bar foo', { ...base, keepOccurrence: 'last' });
    expect(result.output).toBe('bar foo');
  });

  it('detects phrase duplicates', () => {
    const result = deduplicateText('in order to in order to write', {
      ...base,
      detectPhrases: true,
      phraseMinLength: 3,
    });
    expect(result.phraseDuplicates.length).toBeGreaterThan(0);
  });

  it('escapes html in highlights', () => {
    const result = deduplicateText('a <b> a', base);
    expect(result.sourceHighlightHtml).not.toContain('<b>');
    expect(result.sourceHighlightHtml).toContain('&lt;b&gt;');
  });

  it('detects csv-like rows', () => {
    expect(inputLooksLikeCsvRows('a,1\nb,2\nc,3')).toBe(true);
    expect(inputLooksLikeCsvRows('plain\ntext\nonly')).toBe(false);
  });

  it('counts exact duplicate lines', () => {
    expect(countExactDuplicateLines('a\nb\na\na')).toBe(2);
  });

  it('suggests get-started with empty input', () => {
    expect(
      resolveRemoveDuplicateLinesSuggestion({
        hasInput: false,
        mode: 'words',
        csvMode: 'whole',
        removedCount: 0,
        duplicateCount: 0,
        reductionPct: 0,
        inputLooksLikeCsv: false,
        exactDuplicateLineCount: 0,
      })?.id
    ).toBe('rdl-get-started');
  });

  it('suggests lines mode when duplicate rows appear in words mode', () => {
    expect(
      resolveRemoveDuplicateLinesSuggestion({
        hasInput: true,
        mode: 'words',
        csvMode: 'whole',
        removedCount: 0,
        duplicateCount: 0,
        reductionPct: 0,
        inputLooksLikeCsv: false,
        exactDuplicateLineCount: 3,
      })?.id
    ).toBe('rdl-duplicate-lines');
  });

  it('suggests csv first-column option for csv-like input', () => {
    expect(
      resolveRemoveDuplicateLinesSuggestion({
        hasInput: true,
        mode: 'lines',
        csvMode: 'whole',
        removedCount: 0,
        duplicateCount: 1,
        reductionPct: 0,
        inputLooksLikeCsv: true,
        exactDuplicateLineCount: 0,
      })?.id
    ).toBe('rdl-csv-rows');
  });

  it('suggests next step after cleanup', () => {
    expect(
      resolveRemoveDuplicateLinesSuggestion({
        hasInput: true,
        mode: 'words',
        csvMode: 'whole',
        removedCount: 2,
        duplicateCount: 1,
        reductionPct: 15,
        inputLooksLikeCsv: false,
        exactDuplicateLineCount: 0,
      })?.id
    ).toBe('rdl-cleaned');
  });
});
