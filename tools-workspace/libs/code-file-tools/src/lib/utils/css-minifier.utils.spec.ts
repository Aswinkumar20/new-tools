import { CSS_MINIFIER_DEFAULT_OPTIONS, CSS_MINIFIER_SAMPLE } from '../constants/css-minifier.constants';
import {
  buildMinificationResult,
  createMinifierHistoryEntry,
  formatMinifierHistoryPreview,
  looksLikeHtmlSource,
  looksLikeJavaScriptSource,
  prependMinifierHistory
} from './minifier-common.utils';
import {
  looksLikeScssLikeSource,
  minifyCss,
  resolveCssMinifierSuggestion
} from './css-minifier.utils';

describe('css-minifier.utils', () => {
  it('minifies CSS with default options', () => {
    const minified = minifyCss(CSS_MINIFIER_SAMPLE, CSS_MINIFIER_DEFAULT_OPTIONS);
    expect(minified.length).toBeLessThan(CSS_MINIFIER_SAMPLE.length);
    expect(minified).not.toContain('/*');
    expect(minified).toContain('body{');
    expect(minified).toContain('#fff');
  });

  it('shortens hex colors and removes zero units when enabled', () => {
    const withColors = minifyCss('a{color:#ffffff;margin:0px}', {
      ...CSS_MINIFIER_DEFAULT_OPTIONS,
      removeUnits: true
    });
    expect(withColors).toContain('#fff');
    expect(withColors).toContain('margin:0');
    expect(withColors).not.toContain('0px');
  });

  it('builds results and manages history helpers', () => {
    const result = buildMinificationResult('aaaa', 'aa');
    expect(result.reduction).toBe(2);
    expect(result.reductionPercentage).toBe(50);

    const entry = createMinifierHistoryEntry('a', 'b', 1, 100);
    expect(prependMinifierHistory([], entry, 10)).toHaveLength(1);
    expect(prependMinifierHistory([entry], entry, 10)).toHaveLength(1);
    expect(formatMinifierHistoryPreview('x'.repeat(80))).toContain('…');
  });

  it('detects mismatched and scss-like sources', () => {
    expect(looksLikeHtmlSource('<div class="x">')).toBe(true);
    expect(looksLikeJavaScriptSource('const x = () => {}')).toBe(true);
    expect(looksLikeScssLikeSource('$primary: #fff; .btn { &:hover {} }')).toBe(true);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveCssMinifierSuggestion('', null)?.id).toBe('empty-css');
    expect(resolveCssMinifierSuggestion('<html></html>', null)?.path).toBe(
      '/code-file-tools/html-minifier'
    );
    expect(resolveCssMinifierSuggestion('const x = 1;', null)?.path).toBe(
      '/code-file-tools/javascript-minifier'
    );
    expect(resolveCssMinifierSuggestion('$color: red;', null)?.id).toBe('scss-like');

    const strong = buildMinificationResult(CSS_MINIFIER_SAMPLE, minifyCss(CSS_MINIFIER_SAMPLE, CSS_MINIFIER_DEFAULT_OPTIONS));
    if (strong.reductionPercentage >= 40) {
      expect(resolveCssMinifierSuggestion(CSS_MINIFIER_SAMPLE, strong)?.path).toBe(
        '/code-file-tools/html-minifier'
      );
    }
  });
});
