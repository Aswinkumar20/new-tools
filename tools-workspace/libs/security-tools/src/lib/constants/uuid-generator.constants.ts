import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type { UuidGeneratorFormValues } from '../types/uuid-generator.types';

export const UUID_GENERATOR_DEFAULT_FORM: UuidGeneratorFormValues = {
  uppercase: false,
  withBraces: false,
  withHyphens: true,
  count: 1
};

export const UUID_GENERATOR_MIN_COUNT = 1;
export const UUID_GENERATOR_MAX_COUNT = 50;
export const UUID_GENERATOR_HISTORY_LIMIT = 100;

export const UUID_GENERATOR_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Derive a deterministic digest when you need a checksum, not a random ID'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Generate secrets when uniqueness alone is not enough'
  },
  {
    label: 'Private Notes',
    path: '/security-tools/private-notes',
    description: 'Store generated IDs in an encrypted session note if needed'
  },
  {
    label: 'Secure Clipboard',
    path: '/security-tools/secure-clipboard',
    description: 'Copy sensitive IDs with an auto-expiring in-memory store'
  }
];
