import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { LineNumberMode } from '../types/line-number-tool.types';

export const LINE_NUMBER_DEFAULT_MODE: LineNumberMode = 'add';
export const LINE_NUMBER_DEFAULT_START = 1;
export const LINE_NUMBER_DEFAULT_SEPARATOR = '. ';

export const LINE_NUMBER_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Sort numbered or plain lines alphabetically or by length'
  },
  {
    label: 'Remove Duplicate Lines',
    path: '/text-utilities/remove-duplicate-lines',
    description: 'Deduplicate lists before or after numbering'
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing after stripping line numbers'
  },
  {
    label: 'Word Wrap / Unwrap',
    path: '/text-utilities/word-wrap-unwrap',
    description: 'Reflow long lines before adding numbers'
  }
];
