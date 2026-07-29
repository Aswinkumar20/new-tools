import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { RegexFlagState } from '../types/regex-tester.types';

export const REGEX_TESTER_DEFAULT_FLAGS: RegexFlagState = {
  global: true,
  ignoreCase: false,
  multiline: false,
  dotAll: false,
  unicode: false
};

export const REGEX_TESTER_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Apply a regex or plain pattern to rewrite the test string'
  },
  {
    label: 'Extract Emails & URLs',
    path: '/text-utilities/extract-emails-urls',
    description: 'Pull emails and links without writing a custom pattern'
  },
  {
    label: 'Invisible Character Detector',
    path: '/text-utilities/invisible-character-detector',
    description: 'Find hidden characters that can break regex matches'
  },
  {
    label: 'HTML Tag Stripper',
    path: '/text-utilities/html-tag-stripper',
    description: 'Clean markup before testing patterns against prose'
  }
];
