import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const INVISIBLE_CHARACTER_DETECTOR_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Collapse spaces and clean lines after removing hidden characters'
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Delete or replace specific invisible characters by pattern'
  },
  {
    label: 'Unicode Escape / Unescape',
    path: '/text-utilities/unicode-escape-unescape',
    description: 'Inspect or rewrite characters as \\u escapes'
  },
  {
    label: 'Text to ASCII',
    path: '/text-utilities/text-to-ascii',
    description: 'See decimal and hex codes for every character'
  }
];
