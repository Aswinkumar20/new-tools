import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { WordWrapMode } from '../types/word-wrap-unwrap.types';

export const WORD_WRAP_DEFAULT_MODE: WordWrapMode = 'wrap';
export const WORD_WRAP_DEFAULT_WIDTH = 80;
export const WORD_WRAP_MIN_WIDTH = 1;
export const WORD_WRAP_MAX_WIDTH = 500;
export const WORD_WRAP_DEFAULT_SHOW_OPTIONS_PANEL = false;

export const WORD_WRAP_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing before wrapping or after unwrapping',
  },
  {
    label: 'Split & Join Text',
    path: '/text-utilities/split-join-text',
    description: 'Split on a delimiter or join lines with a custom separator',
  },
  {
    label: 'Line Number Tool',
    path: '/text-utilities/line-number-tool',
    description: 'Add or strip line numbers on wrapped paragraphs',
  },
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Sort lines after wrapping into a list',
  },
];
