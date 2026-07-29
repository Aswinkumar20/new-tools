import {
  convertTrimNormalizeText,
  countActiveTrimNormalizeOptions,
  inputHasCollapsedWhitespaceRuns,
  inputHasEmptyLines,
  inputHasLineEdgeWhitespace,
  inputHasNonLfLineEndings,
  resolveTrimNormalizeSuggestion,
} from './trim-normalize-whitespace.utils';

describe('trim-normalize-whitespace.utils', () => {
  it('trims line edges by default-style options', () => {
    expect(
      convertTrimNormalizeText({
        inputText: '  hello  \n  world  ',
        trimLines: true,
        collapseSpaces: false,
        removeEmptyLines: false,
        normalizeLineEndings: false,
      }).output
    ).toBe('hello\nworld');
  });

  it('collapses spaces and removes empty lines', () => {
    expect(
      convertTrimNormalizeText({
        inputText: 'a   b\n\nc',
        trimLines: true,
        collapseSpaces: true,
        removeEmptyLines: true,
        normalizeLineEndings: false,
      }).output
    ).toBe('a b\nc');
  });

  it('normalizes CRLF to LF', () => {
    expect(
      convertTrimNormalizeText({
        inputText: 'a\r\nb\r\n',
        trimLines: false,
        collapseSpaces: false,
        removeEmptyLines: false,
        normalizeLineEndings: true,
      }).output
    ).toBe('a\nb\n');
  });

  it('counts active options', () => {
    expect(
      countActiveTrimNormalizeOptions({
        trimLines: true,
        collapseSpaces: false,
        removeEmptyLines: true,
        normalizeLineEndings: false,
      })
    ).toBe(2);
  });

  it('detects whitespace issues', () => {
    expect(inputHasLineEdgeWhitespace('  x')).toBe(true);
    expect(inputHasCollapsedWhitespaceRuns('a  b')).toBe(true);
    expect(inputHasCollapsedWhitespaceRuns('  hello  ')).toBe(false);
    expect(inputHasEmptyLines('a\n\nb')).toBe(true);
    expect(inputHasNonLfLineEndings('a\r\nb')).toBe(true);
  });

  it('suggests get-started when empty', () => {
    expect(
      resolveTrimNormalizeSuggestion({
        hasInput: false,
        hasOutput: false,
        outputUnchanged: false,
        trimLines: true,
        collapseSpaces: false,
        removeEmptyLines: false,
        normalizeLineEndings: false,
        hasLineEdgeWhitespace: false,
        hasCollapsedWhitespaceRuns: false,
        hasEmptyLines: false,
        hasNonLfLineEndings: false,
        activeOptionCount: 1,
      })?.id
    ).toBe('tnw-get-started');
  });

  it('suggests enabling CRLF normalize', () => {
    expect(
      resolveTrimNormalizeSuggestion({
        hasInput: true,
        hasOutput: true,
        outputUnchanged: false,
        trimLines: true,
        collapseSpaces: false,
        removeEmptyLines: false,
        normalizeLineEndings: false,
        hasLineEdgeWhitespace: false,
        hasCollapsedWhitespaceRuns: false,
        hasEmptyLines: false,
        hasNonLfLineEndings: true,
        activeOptionCount: 1,
      })?.id
    ).toBe('tnw-crlf');
  });

  it('suggests cleaned when output changed', () => {
    expect(
      resolveTrimNormalizeSuggestion({
        hasInput: true,
        hasOutput: true,
        outputUnchanged: false,
        trimLines: true,
        collapseSpaces: false,
        removeEmptyLines: false,
        normalizeLineEndings: false,
        hasLineEdgeWhitespace: false,
        hasCollapsedWhitespaceRuns: false,
        hasEmptyLines: false,
        hasNonLfLineEndings: false,
        activeOptionCount: 1,
      })?.id
    ).toBe('tnw-cleaned');
  });
});
