import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { CssMinifierOptions } from '../types/css-minifier.types';

export const CSS_MINIFIER_HISTORY_LIMIT = 10;
export const CSS_MINIFIER_HISTORY_PREVIEW_LENGTH = 60;

export const CSS_MINIFIER_SAMPLE = `/* Sample CSS for minification */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #ffffff;
    color: #000000;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.button {
    background-color: #007bff;
    color: #ffffff;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.button:hover {
    background-color: #0056b3;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
}`;

export const CSS_MINIFIER_DEFAULT_OPTIONS: CssMinifierOptions = {
  removeComments: true,
  removeWhitespace: true,
  removeEmptyRules: true,
  optimizeColors: true,
  removeUnnecessarySemicolons: true,
  removeUnits: false,
  lowercaseSelectors: false,
  rememberHistory: true
};

export const CSS_MINIFIER_COLOR_MAP: Readonly<Record<string, string>> = {
  white: '#fff',
  black: '#000',
  red: '#f00',
  green: '#0f0',
  blue: '#00f'
};

export const CSS_MINIFIER_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'HTML Minifier',
    path: '/code-file-tools/html-minifier',
    description: 'Minify HTML documents and templates'
  },
  {
    label: 'JavaScript Minifier',
    path: '/code-file-tools/javascript-minifier',
    description: 'Minify scripts and remove debug noise'
  },
  {
    label: 'HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder',
    description: 'Escape CSS-in-HTML snippets safely'
  },
  {
    label: 'Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer',
    description: 'Inspect CSS copied from DevTools'
  }
];
