import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { FindAndReplaceOptionsState } from '../types/find-and-replace.types';

export const FIND_AND_REPLACE_DEFAULT_OPTIONS: FindAndReplaceOptionsState = {
  useRegex: false,
  caseSensitive: false,
  replaceAll: true
};

export const FIND_AND_REPLACE_SHOW_OPTIONS_DEFAULT = true;

export const FIND_AND_REPLACE_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Regex Tester',
    path: '/text-utilities/regex-tester',
    description: 'Debug capture groups and match positions before replacing'
  },
  {
    label: 'Text Difference',
    path: '/text-utilities/text-difference',
    description: 'Compare original and replaced text side by side'
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing before or after bulk replacements'
  },
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Sort the result when replacements produce a list'
  }
];
