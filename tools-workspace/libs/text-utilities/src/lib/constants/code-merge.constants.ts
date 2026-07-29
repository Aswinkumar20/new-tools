import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const CODE_MERGE_DEFAULT_BASE_LABEL = 'HEAD';
export const CODE_MERGE_DEFAULT_INCOMING_LABEL = 'Incoming';
export const CODE_MERGE_DEFAULT_INCLUDE_MARKERS = true;

export const CODE_MERGE_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Text Difference',
    path: '/text-utilities/text-difference',
    description: 'See a real line-by-line diff before committing a merge block'
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Clean conflict markers or rename symbols after merging'
  },
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Normalize lists or imports before comparing branches'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON snippets pasted into either branch'
  }
];
