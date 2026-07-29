import {
  HTML_MINIFIER_DEFAULT_OPTIONS,
  HTML_MINIFIER_SAMPLE
} from '../constants/html-minifier.constants';
import { buildMinificationResult } from './minifier-common.utils';
import {
  looksLikeCssOnlySource,
  minifyHtml,
  resolveHtmlMinifierSuggestion
} from './html-minifier.utils';

describe('html-minifier.utils', () => {
  it('minifies HTML with default options', () => {
    const minified = minifyHtml(HTML_MINIFIER_SAMPLE, HTML_MINIFIER_DEFAULT_OPTIONS);
    expect(minified.length).toBeLessThan(HTML_MINIFIER_SAMPLE.length);
    expect(minified).not.toContain('<!--');
    expect(minified).toContain('<h1>');
  });

  it('minifies inline CSS and JS when enabled', () => {
    const withAssets = minifyHtml(
      '<style>/*c*/ body { color: red; }</style><script>//x\nconst a = 1;</script>',
      { ...HTML_MINIFIER_DEFAULT_OPTIONS, minifyCSS: true, minifyJS: true }
    );
    expect(withAssets).not.toContain('/*c*/');
    expect(withAssets).not.toContain('//x');
  });

  it('detects css-only sources and resolves suggestions', () => {
    expect(looksLikeCssOnlySource('body { color: red; }')).toBe(true);
    expect(looksLikeCssOnlySource('<div></div>')).toBe(false);

    expect(resolveHtmlMinifierSuggestion('', null)?.path).toBe(
      '/code-file-tools/html-entity-encoder'
    );
    expect(resolveHtmlMinifierSuggestion('body{color:red}', null)?.path).toBe(
      '/code-file-tools/css-minifier'
    );

    const result = buildMinificationResult(
      HTML_MINIFIER_SAMPLE,
      minifyHtml(HTML_MINIFIER_SAMPLE, HTML_MINIFIER_DEFAULT_OPTIONS)
    );
    if (result.reductionPercentage >= 30) {
      expect(resolveHtmlMinifierSuggestion(HTML_MINIFIER_SAMPLE, result)?.path).toBe(
        '/code-file-tools/css-minifier'
      );
    }
  });
});
