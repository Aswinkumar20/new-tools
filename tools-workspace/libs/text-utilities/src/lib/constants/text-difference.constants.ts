import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const TEXT_DIFF_THEMES = ['vs-dark', 'vs-light', 'hc-black'] as const;

export const TEXT_DIFF_LANGUAGES = [
  'typescript',
  'javascript',
  'json',
  'html',
  'css',
  'markdown',
  'python',
  'java',
  'xml',
  'yaml',
  'plaintext',
] as const;

export const TEXT_DIFF_DEFAULT_THEME = TEXT_DIFF_THEMES[0];
export const TEXT_DIFF_DEFAULT_LANGUAGE = TEXT_DIFF_LANGUAGES[0];
export const TEXT_DIFF_DEFAULT_FONT_SIZE = 14;
export const TEXT_DIFF_MIN_FONT_SIZE = 8;
export const TEXT_DIFF_MAX_FONT_SIZE = 32;
export const TEXT_DIFF_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const TEXT_DIFF_DEFAULT_ORIGINAL = 'heLLo world!\nThis is the original text.';
export const TEXT_DIFF_DEFAULT_MODIFIED = 'hello world!\nThis is the modified text.';

export const TEXT_DIFF_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Code Merge',
    path: '/text-utilities/code-merge',
    description: 'Combine two versions after reviewing the diff',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Apply targeted edits across either side',
  },
  {
    label: 'Text Similarity',
    path: '/text-utilities/text-similarity',
    description: 'Score how alike two strings are overall',
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON before comparing structured files',
  },
];
