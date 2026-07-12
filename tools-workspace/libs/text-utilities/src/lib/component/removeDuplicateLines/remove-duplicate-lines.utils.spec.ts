import {
  deduplicateText,
  DEFAULT_DEDUP_OPTIONS,
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
});
