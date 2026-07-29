import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { SortMode, SortModeOption } from '../types/sort-lines.types';

export const SORT_LINES_DEFAULT_MODE: SortMode = 'az';
export const SORT_LINES_DEFAULT_CASE_SENSITIVE = false;

export const SORT_LINES_MODE_OPTIONS: ReadonlyArray<SortModeOption> = [
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'length-asc', label: 'Length ↑' },
  { value: 'length-desc', label: 'Length ↓' },
  { value: 'numeric', label: 'Numeric' },
];

export const SORT_LINES_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Remove Duplicate Lines',
    path: '/text-utilities/remove-duplicate-lines',
    description: 'Deduplicate lists before or after sorting',
  },
  {
    label: 'Line Number Tool',
    path: '/text-utilities/line-number-tool',
    description: 'Add or strip line numbers on a sorted list',
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing so alphabetical order is predictable',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Rewrite tokens that affect sort order',
  },
];
