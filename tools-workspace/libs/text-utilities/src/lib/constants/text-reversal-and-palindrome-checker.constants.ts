import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  TextReversalMode,
  TextReversalSample,
} from '../types/text-reversal-and-palindrome-checker.types';

export const TEXT_REVERSAL_DEFAULT_MODE: TextReversalMode = 'palindrome';
export const TEXT_REVERSAL_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const TEXT_REVERSAL_SAMPLES: ReadonlyArray<TextReversalSample> = [
  { text: 'Never odd or even', badge: 'Palindrome', badgeKind: 'yes' },
  { text: 'Hello, world!', badge: 'Not palindrome', badgeKind: 'no' },
  { text: 'drawer', badge: '→ reward', badgeKind: 'neutral' },
];

export const TEXT_REVERSAL_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'ROT13 Cipher',
    path: '/text-utilities/rot13-cipher',
    description: 'Rotate letters for a reversible obfuscation',
  },
  {
    label: 'Text Case Convertor',
    path: '/text-utilities/text-case-convertor',
    description: 'Change casing before checking palindromes',
  },
  {
    label: 'Text Similarity',
    path: '/text-utilities/text-similarity',
    description: 'Score how close two strings are',
  },
  {
    label: 'Slug Generator',
    path: '/text-utilities/slug-generator',
    description: 'Normalize titles into URL-friendly slugs',
  },
];
