import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type {
  RandomPasswordFormValues,
  RandomPasswordStrengthLevel
} from '../types/random-password-generator.types';

export const RANDOM_PASSWORD_DEFAULT_FORM: RandomPasswordFormValues = {
  length: 16,
  includeLowercase: true,
  includeUppercase: true,
  includeNumbers: true,
  includeSymbols: true,
  avoidAmbiguous: true
};

export const RANDOM_PASSWORD_MIN_LENGTH = 4;
export const RANDOM_PASSWORD_MAX_LENGTH = 128;

export const RANDOM_PASSWORD_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const RANDOM_PASSWORD_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const RANDOM_PASSWORD_NUMBERS = '0123456789';
export const RANDOM_PASSWORD_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>/?';
export const RANDOM_PASSWORD_AMBIGUOUS = 'O0l1I';

export const RANDOM_PASSWORD_STRENGTH_ORDER: ReadonlyArray<RandomPasswordStrengthLevel> = [
  'very-weak',
  'weak',
  'medium',
  'strong',
  'very-strong'
];

export const RANDOM_PASSWORD_STRENGTH_LABELS: Readonly<
  Record<RandomPasswordStrengthLevel, string>
> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very strong'
};

export const RANDOM_PASSWORD_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Password Strength Checker',
    path: '/security-tools/password-strength-checker',
    description: 'Re-score a generated password with a detailed tip breakdown'
  },
  {
    label: 'Private Notes',
    path: '/security-tools/private-notes',
    description: 'Encrypt a note using a freshly generated passphrase'
  },
  {
    label: 'Secure Clipboard',
    path: '/security-tools/secure-clipboard',
    description: 'Copy sensitive text with an auto-expiring in-memory store'
  },
  {
    label: 'UUID Generator',
    path: '/security-tools/uuid-generator',
    description: 'Generate random IDs when uniqueness matters more than memorability'
  }
];
