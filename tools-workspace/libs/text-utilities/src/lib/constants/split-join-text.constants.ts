import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { SplitJoinMode } from '../types/split-join-text.types';

export const SPLIT_JOIN_DEFAULT_MODE: SplitJoinMode = 'split';
export const SPLIT_JOIN_DEFAULT_DELIMITER = ',';

export const SPLIT_JOIN_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Order items after splitting into lines',
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spaces around delimiters before joining',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Change delimiters or normalize tokens first',
  },
  {
    label: 'Word Wrap / Unwrap',
    path: '/text-utilities/word-wrap-unwrap',
    description: 'Reflow long lines before or after joining',
  },
];
