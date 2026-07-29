import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { HtmlMinifierOptions } from '../types/html-minifier.types';

export const HTML_MINIFIER_HISTORY_LIMIT = 10;
export const HTML_MINIFIER_HISTORY_PREVIEW_LENGTH = 60;

export const HTML_MINIFIER_SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample HTML Document</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
    </style>
</head>
<body>
    <h1>Welcome to HTML Minifier</h1>
    <p>This is a sample HTML document for testing minification.</p>
    <script>
        console.log('Hello, World!');
    </script>
</body>
</html>`;

export const HTML_MINIFIER_DEFAULT_OPTIONS: HtmlMinifierOptions = {
  removeComments: true,
  collapseWhitespace: true,
  removeAttributeQuotes: false,
  removeOptionalTags: false,
  removeEmptyAttributes: true,
  caseSensitive: true,
  minifyCSS: false,
  minifyJS: false,
  rememberHistory: true
};

export const HTML_MINIFIER_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder',
    description: 'Encode special characters before embedding'
  },
  {
    label: 'CSS Minifier',
    path: '/code-file-tools/css-minifier',
    description: 'Minify stylesheets linked from HTML'
  },
  {
    label: 'JavaScript Minifier',
    path: '/code-file-tools/javascript-minifier',
    description: 'Minify scripts used by the page'
  },
  {
    label: 'Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer',
    description: 'Inspect HTML copied from DevTools'
  }
];
