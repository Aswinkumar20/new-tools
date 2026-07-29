import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import { CSS_MINIFIER_COLOR_MAP } from '../constants/css-minifier.constants';
import type { CssMinifierOptions } from '../types/css-minifier.types';
import type { MinificationResult } from '../types/minifier.types';
import {
  looksLikeHtmlSource,
  looksLikeJavaScriptSource
} from './minifier-common.utils';

export function minifyCss(css: string, options: CssMinifierOptions): string {
  let result = css;

  if (options.removeComments) {
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  if (options.removeWhitespace) {
    result = result.replace(/\s*([{}:;,>+~])\s*/g, '$1');
    result = result.replace(/\s*;/g, ';');
    result = result.replace(/:\s*/g, ':');
    result = result.replace(/\s*,\s*/g, ',');
    result = result.replace(/\s*{\s*/g, '{');
    result = result.replace(/\s*}\s*/g, '}');
    result = result.trim();
  }

  if (options.removeUnnecessarySemicolons) {
    result = result.replace(/;}/g, '}');
    result = result.replace(/;$/g, '');
  }

  if (options.removeEmptyRules) {
    result = result.replace(/[^{}]+{\s*}/g, '');
    result = result.replace(/}+/g, '}');
  }

  if (options.optimizeColors) {
    result = result.replace(
      /#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3(?!\w)/g,
      '#$1$2$3'
    );
    result = result.replace(
      /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
      (match, r, g, b) => {
        const hex =
          '#' +
          [r, g, b]
            .map((channel) => {
              return Number.parseInt(channel, 10).toString(16).padStart(2, '0');
            })
            .join('');
        return hex.length <= match.length ? hex : match;
      }
    );
    for (const [name, hex] of Object.entries(CSS_MINIFIER_COLOR_MAP)) {
      result = result.replace(new RegExp(`\\b${name}\\b`, 'gi'), hex);
    }
  }

  if (options.removeUnits) {
    result = result.replace(
      /(\s|:)(0)(px|em|rem|pt|pc|in|cm|mm|ex|ch|vw|vh|vmin|vmax|%|deg|rad|grad|ms|s|Hz|kHz)/g,
      '$1$2'
    );
  }

  if (options.lowercaseSelectors) {
    result = result.replace(/([^{}]+){/g, (match) => match.toLowerCase());
  }

  return result.trim();
}

export function looksLikeScssLikeSource(text: string): boolean {
  return /\$[\w-]+\s*:/.test(text) || /&[:\w.#\[]/.test(text) || /@(mixin|include|extend)\b/.test(text);
}

export function resolveCssMinifierSuggestion(
  input: string,
  result: MinificationResult | null
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-css',
      title: 'Paste CSS to minify',
      reason:
        'Drop stylesheets here for instant compression. If you copied HTML or JS instead, switch to the matching minifier.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (looksLikeHtmlSource(trimmed)) {
    return {
      id: 'html-input',
      title: 'Input looks like HTML',
      reason:
        'This content includes markup tags. HTML Minifier handles documents and embedded CSS/JS more safely.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  if (looksLikeJavaScriptSource(trimmed)) {
    return {
      id: 'js-input',
      title: 'Input looks like JavaScript',
      reason:
        'Function and console patterns suggest script source. Use JavaScript Minifier for JS-specific cleanup.',
      actionLabel: 'Open JavaScript Minifier',
      path: '/code-file-tools/javascript-minifier'
    };
  }

  if (looksLikeScssLikeSource(trimmed)) {
    return {
      id: 'scss-like',
      title: 'SCSS-like syntax detected',
      reason:
        'Variables, nesting, or mixins may not minify correctly here. Compile to plain CSS first, then minify the output.',
      actionLabel: 'Open Clipboard Viewer',
      path: '/code-file-tools/clipboard-viewer'
    };
  }

  if (result && result.reductionPercentage >= 40) {
    return {
      id: 'pair-html',
      title: 'Strong CSS savings — minify HTML next',
      reason:
        'You already cut a large share of stylesheet size. Pair with HTML Minifier to shrink the full page payload.',
      actionLabel: 'Open HTML Minifier',
      path: '/code-file-tools/html-minifier'
    };
  }

  return {
    id: 'pair-js',
    title: 'Continue with script minification',
    reason:
      'CSS is only part of front-end weight. Minify JavaScript next for a fuller performance pass.',
    actionLabel: 'Open JavaScript Minifier',
    path: '/code-file-tools/javascript-minifier'
  };
}
