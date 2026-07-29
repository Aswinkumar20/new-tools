import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const HTML_TAG_STRIPPER_DEFAULT_PRESERVE_LINE_BREAKS = true;

export const HTML_TAG_STRIPPER_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing after tags are removed'
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Rewrite leftover fragments or leftover markup patterns'
  },
  {
    label: 'Extract Emails & URLs',
    path: '/text-utilities/extract-emails-urls',
    description: 'Pull addresses and links from the plain-text result'
  },
  {
    label: 'Word & Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Measure the cleaned text after stripping'
  }
];
