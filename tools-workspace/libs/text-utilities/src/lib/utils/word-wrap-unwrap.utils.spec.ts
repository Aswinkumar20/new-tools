import {
  clampWrapWidth,
  convertWordWrapText,
  inputHasLongLines,
  inputHasSoftLineBreaks,
  resolveWordWrapSuggestion,
} from './word-wrap-unwrap.utils';

describe('word-wrap-unwrap.utils', () => {
  it('clamps wrap width', () => {
    expect(clampWrapWidth(0)).toBe(80);
    expect(clampWrapWidth(10)).toBe(10);
    expect(clampWrapWidth(999)).toBe(500);
  });

  it('wraps text at column width', () => {
    const result = convertWordWrapText({
      mode: 'wrap',
      inputText: 'hello world test',
      wrapWidth: 10,
    });
    expect(result.output).toContain('\n');
  });

  it('unwraps soft line breaks', () => {
    expect(
      convertWordWrapText({
        mode: 'unwrap',
        inputText: 'hello\nworld',
        wrapWidth: 80,
      }).output
    ).toBe('hello world');
  });

  it('preserves paragraph breaks when unwrapping', () => {
    expect(
      convertWordWrapText({
        mode: 'unwrap',
        inputText: 'a\n\nb',
        wrapWidth: 80,
      }).output
    ).toBe('a\n\nb');
  });

  it('detects long lines and soft breaks', () => {
    expect(inputHasLongLines('short\nthis is a longer line of text', 10)).toBe(true);
    expect(inputHasSoftLineBreaks('a\nb')).toBe(true);
    expect(inputHasSoftLineBreaks('a\n\nb')).toBe(false);
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveWordWrapSuggestion({
        mode: 'wrap',
        hasInput: false,
        hasOutput: false,
        wrapWidth: 80,
        outputUnchanged: false,
        hasLongLines: false,
        hasSoftLineBreaks: false,
      })?.id
    ).toBe('wwu-get-started');
  });

  it('suggests already-short when wrap has no long lines', () => {
    expect(
      resolveWordWrapSuggestion({
        mode: 'wrap',
        hasInput: true,
        hasOutput: true,
        wrapWidth: 80,
        outputUnchanged: true,
        hasLongLines: false,
        hasSoftLineBreaks: false,
      })?.id
    ).toBe('wwu-already-short');
  });

  it('suggests wrapped when long lines were wrapped', () => {
    expect(
      resolveWordWrapSuggestion({
        mode: 'wrap',
        hasInput: true,
        hasOutput: true,
        wrapWidth: 40,
        outputUnchanged: false,
        hasLongLines: true,
        hasSoftLineBreaks: false,
      })?.id
    ).toBe('wwu-wrapped');
  });
});
