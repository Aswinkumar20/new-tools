import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { TrimNormalizeOptions } from '../types/trim-normalize-whitespace.types';

export const TRIM_NORMALIZE_DEFAULT_OPTIONS: Readonly<TrimNormalizeOptions> = {
  trimLines: true,
  collapseSpaces: false,
  removeEmptyLines: false,
  normalizeLineEndings: false,
};

export const TRIM_NORMALIZE_DEFAULT_SHOW_OPTIONS_PANEL = true;

export const TRIM_NORMALIZE_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Invisible Character Detector',
    path: '/text-utilities/invisible-character-detector',
    description: 'Find zero-width and other hidden characters',
  },
  {
    label: 'Remove Duplicate Lines',
    path: '/text-utilities/remove-duplicate-lines',
    description: 'Deduplicate after cleaning spacing',
  },
  {
    label: 'Sort Lines',
    path: '/text-utilities/sort-lines',
    description: 'Order cleaned lines alphabetically or by length',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Target remaining spacing patterns with find/replace',
  },
];
