import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { DedupOptions } from '../types/remove-duplicate-lines.types';

export { STOP_WORDS } from './words-and-character-counter.constants';

export const DEFAULT_LOCALE = 'en';

export const REMOVE_DUPLICATE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const DEFAULT_DEDUP_OPTIONS: DedupOptions = {
  mode: 'words',
  caseSensitive: false,
  ignorePunctuation: true,
  trimTokens: true,
  keepOccurrence: 'first',
  preserveLineBreaks: true,
  ignoreStopWords: false,
  detectPhrases: true,
  phraseMinLength: 2,
  unicodeForm: 'NFC',
  locale: DEFAULT_LOCALE,
  emptyLines: 'keep',
  csvMode: 'whole',
};

export const REMOVE_DUPLICATE_LINES_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Order a cleaned list alphabetically or by length',
  },
  {
    label: 'Line Number Tool',
    path: '/text-utilities/line-number-tool',
    description: 'Add or strip line numbers after deduplicating',
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Fix spacing and blank lines before or after cleanup',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Rewrite tokens that should not be treated as duplicates',
  },
];
