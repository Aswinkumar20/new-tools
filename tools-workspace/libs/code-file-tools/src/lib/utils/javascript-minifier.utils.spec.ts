import {
  JS_MINIFIER_DEFAULT_OPTIONS,
  JS_MINIFIER_SAMPLE
} from '../constants/javascript-minifier.constants';
import { buildMinificationResult } from './minifier-common.utils';
import {
  looksLikeTypeScriptSource,
  minifyJavaScript,
  resolveJavascriptMinifierSuggestion
} from './javascript-minifier.utils';

describe('javascript-minifier.utils', () => {
  it('minifies JavaScript with default options', () => {
    const minified = minifyJavaScript(JS_MINIFIER_SAMPLE, JS_MINIFIER_DEFAULT_OPTIONS);
    expect(minified.length).toBeLessThan(JS_MINIFIER_SAMPLE.length);
    expect(minified).not.toContain('// Sample');
    expect(minified).toContain('calculateTotal');
    expect(minified).toContain('console.log');
  });

  it('strips console and debugger when enabled', () => {
    const source = 'const x = 1; console.log(x); debugger; return x;';
    const minified = minifyJavaScript(source, {
      ...JS_MINIFIER_DEFAULT_OPTIONS,
      removeConsoleLogs: true,
      removeDebugger: true
    });
    expect(minified).not.toContain('console.log');
    expect(minified).not.toContain('debugger');
    expect(minified).toContain('const x');
  });

  it('detects TypeScript-like sources and resolves suggestions', () => {
    expect(looksLikeTypeScriptSource('interface User { name: string }')).toBe(true);
    expect(looksLikeTypeScriptSource('const x = 1;')).toBe(false);

    expect(resolveJavascriptMinifierSuggestion('', null)?.path).toBe(
      '/code-file-tools/html-minifier'
    );
    expect(resolveJavascriptMinifierSuggestion('body{color:red}', null)?.path).toBe(
      '/code-file-tools/css-minifier'
    );
    expect(resolveJavascriptMinifierSuggestion('<div></div>', null)?.path).toBe(
      '/code-file-tools/html-minifier'
    );

    const result = buildMinificationResult(
      JS_MINIFIER_SAMPLE,
      minifyJavaScript(JS_MINIFIER_SAMPLE, JS_MINIFIER_DEFAULT_OPTIONS)
    );
    expect(resolveJavascriptMinifierSuggestion(JS_MINIFIER_SAMPLE, result)?.path).toBeTruthy();
  });
});
