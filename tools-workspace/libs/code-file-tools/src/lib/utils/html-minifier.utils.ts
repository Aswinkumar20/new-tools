import type { CftToolSuggestion } from '../shared/cft-tool-suggestion.model';
import type { HtmlMinifierOptions } from '../types/html-minifier.types';
import type { MinificationResult } from '../types/minifier.types';
import { looksLikeEncodedHtmlEntities } from './html-entity-encoder.utils';
import {
  looksLikeCssOnlySource,
  looksLikeJavaScriptSource
} from './minifier-common.utils';

export { looksLikeCssOnlySource } from './minifier-common.utils';

export function minifyHtml(html: string, options: HtmlMinifierOptions): string {
  let result = html;

  if (options.removeComments) {
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  }

  if (options.collapseWhitespace) {
    result = result.replace(/>\s+</g, '><');
    result = result.replace(/\s+/g, ' ');
    result = result.replace(/^\s+|\s+$/g, '');
  }

  if (options.removeOptionalTags) {
    result = result.replace(/<\/?(html|head|body)[^>]*>/gi, '');
  }

  if (options.removeEmptyAttributes) {
    result = result.replace(/\s+(\w+)=""/g, '');
    result = result.replace(/\s+(\w+)=''/g, '');
  }

  if (options.removeAttributeQuotes) {
    result = result.replace(/(\w+)="([^"]*)"/g, (match, attr, value) => {
      if (!/[ =<>"'`]/.test(value)) {
        return `${attr}=${value}`;
      }
      return match;
    });
  }

  if (options.minifyCSS) {
    result = result.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      const minifiedCSS = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/;\s*}/g, '}')
        .replace(/\s*{\s*/g, '{')
        .replace(/;\s*/g, ';')
        .trim();
      return match.replace(css, minifiedCSS);
    });
  }

  if (options.minifyJS) {
    result = result.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, js) => {
      const minifiedJS = js
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*;\s*/g, ';')
        .trim();
      return match.replace(js, minifiedJS);
    });
  }

  return result.trim();
}

export function resolveHtmlMinifierSuggestion(
  input: string,
  result: MinificationResult | null
): CftToolSuggestion | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      id: 'empty-html',
      title: 'Paste HTML to minify',
      reason:
        'Drop a document or fragment here. If you only need entity escaping, use HTML Entity Encoder instead.',
      actionLabel: 'Open HTML Entity Encoder',
      path: '/code-file-tools/html-entity-encoder'
    };
  }

  if (looksLikeCssOnlySource(trimmed)) {
    return {
      id: 'css-input',
      title: 'Input looks like CSS',
      reason:
        'Stylesheet rules were detected without markup. CSS Minifier is a better fit for this content.',
      actionLabel: 'Open CSS Minifier',
      path: '/code-file-tools/css-minifier'
    };
  }

  if (looksLikeJavaScriptSource(trimmed) && !/<\/?[a-zA-Z]/.test(trimmed)) {
    return {
      id: 'js-input',
      title: 'Input looks like JavaScript',
      reason:
        'Script syntax was detected without HTML tags. Use JavaScript Minifier for JS-specific cleanup.',
      actionLabel: 'Open JavaScript Minifier',
      path: '/code-file-tools/javascript-minifier'
    };
  }

  if (looksLikeEncodedHtmlEntities(trimmed) && /&lt;|&gt;|&amp;/.test(trimmed)) {
    return {
      id: 'encoded-html',
      title: 'HTML entities detected in input',
      reason:
        'Decode entities first if you want to minify real markup, or keep encoding for safe embedding.',
      actionLabel: 'Open HTML Entity Encoder',
      path: '/code-file-tools/html-entity-encoder'
    };
  }

  if (result && result.reductionPercentage >= 30) {
    return {
      id: 'pair-css',
      title: 'Strong HTML savings — minify CSS next',
      reason:
        'Markup is leaner. Compress linked or inline stylesheets with CSS Minifier for more transfer savings.',
      actionLabel: 'Open CSS Minifier',
      path: '/code-file-tools/css-minifier'
    };
  }

  return {
    id: 'pair-entities',
    title: 'Encode special characters when embedding',
    reason:
      'After minifying, use HTML Entity Encoder for attribute-safe text and symbols before publishing.',
    actionLabel: 'Open HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder'
  };
}
