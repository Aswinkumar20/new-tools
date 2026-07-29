import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import type { JavascriptMinifierOptions } from '../types/javascript-minifier.types';
import type { MinificationResult } from '../types/minifier.types';
import {
  looksLikeCssOnlySource,
  looksLikeHtmlSource
} from './minifier-common.utils';

export function minifyJavaScript(js: string, options: JavascriptMinifierOptions): string {
  let result = js;

  if (options.removeComments) {
    result = result.replace(/\/\/.*$/gm, '');
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  if (options.removeConsoleLogs) {
    result = result.replace(/console\.(log|debug|info|warn|error)\([^)]*\);?\s*/g, '');
  }

  if (options.removeDebugger) {
    result = result.replace(/debugger\s*;?\s*/g, '');
  }

  if (options.removeWhitespace) {
    result = result.replace(/\s*([=+\-*/%<>!&|?:,;{}()\[\]])\s*/g, '$1');
    result = result.replace(
      /\b(if|else|for|while|function|return|var|let|const|class|extends|import|export)\s+/g,
      '$1 '
    );
    result = result.replace(/\s+/g, ' ');
    result = result.replace(/^\s+|\s+$/gm, '');
    result = result.replace(/\n\s*\n/g, '\n');
  }

  if (options.removeUnnecessarySemicolons) {
    result = result.replace(/;\s*}/g, '}');
    result = result.replace(/;$/gm, '');
    result = result.replace(/;\s*\n/g, '\n');
  }

  if (options.removeEmptyStatements) {
    result = result.replace(/\{\s*\}/g, '{}');
    result = result.replace(/;\s*;/g, ';');
  }

  return result.trim();
}

export function looksLikeTypeScriptSource(text: string): boolean {
  const trimmed = text.trim();
  if (looksLikeHtmlSource(trimmed)) {
    return false;
  }
  return (
    /\b(interface|type|enum|namespace)\s+\w+/.test(trimmed) ||
    /:\s*(string|number|boolean|any|void|unknown|never)\b/.test(trimmed) ||
    /\bas\s+(const|string|number|boolean)\b/.test(trimmed) ||
    /<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*>/.test(trimmed)
  );
}

export function resolveJavascriptMinifierSuggestion(
  input: string,
  result: MinificationResult | null
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-js',
      title: 'Paste JavaScript to minify',
      reason:
        'Drop script source here for instant compression. If you copied HTML or CSS instead, switch to the matching minifier.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (looksLikeHtmlSource(trimmed)) {
    return {
      id: 'html-input',
      title: 'Input looks like HTML',
      reason:
        'Markup tags were detected. HTML Minifier can shrink documents and optionally minify embedded scripts.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (looksLikeTypeScriptSource(trimmed)) {
    return {
      id: 'ts-like',
      title: 'TypeScript-like syntax detected',
      reason:
        'Type annotations or interfaces may break under regex minification. Compile/transpile to plain JS first, then minify.',
      actionLabel: 'Open Clipboard Viewer',
      path: '/code-file-tools/clipboard-viewer'
    };
  }

  if (looksLikeCssOnlySource(trimmed)) {
    return {
      id: 'css-input',
      title: 'Input looks like CSS',
      reason:
        'Selectors and declarations suggest a stylesheet. Use CSS Minifier for rule-aware compression.',
      actionLabel: 'Open CSS Minifier',
      path: '/code-file-tools/css-minifier'
    };
  }

  if (result && result.reductionPercentage >= 40) {
    return {
      id: 'pair-css',
      title: 'Strong JS savings — minify CSS next',
      reason:
        'Script size dropped significantly. Pair with CSS Minifier to shrink the remaining front-end payload.',
      actionLabel: 'Open CSS Minifier',
      path: '/code-file-tools/css-minifier'
    };
  }

  return {
    id: 'pair-html',
    title: 'Continue with HTML minification',
    reason:
      'Scripts are only part of page weight. Minify the surrounding HTML (and inline assets) for a fuller pass.',
    actionLabel: 'Open HTML Minifier',
    path: '/code-file-tools/html-minifier'
  };
}
