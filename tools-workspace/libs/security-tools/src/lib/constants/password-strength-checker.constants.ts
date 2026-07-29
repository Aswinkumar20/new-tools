import type { StRelatedToolLink } from '../shared/st-tool-suggestion.model';
import type {
  PasswordStrengthFormValues,
  PasswordStrengthLevel
} from '../types/password-strength-checker.types';

export const PASSWORD_STRENGTH_DEFAULT_FORM: PasswordStrengthFormValues = {
  password: '',
  showDetails: true
};

export const PASSWORD_STRENGTH_MAX_SCORE = 12;

export const PASSWORD_STRENGTH_LENGTH_THRESHOLDS: ReadonlyArray<number> = [
  8, 10, 12, 16, 20, 24
];

export const PASSWORD_STRENGTH_COMMON_PATTERN =
  /(1234|abcd|qwer|password|letmein)/i;

export const PASSWORD_STRENGTH_REPEAT_PATTERN = /(.)\1{2,}/;

export const PASSWORD_STRENGTH_LEVEL_THRESHOLDS: ReadonlyArray<{
  minScore: number;
  level: PasswordStrengthLevel;
}> = [
  { minScore: 10, level: 'very-strong' },
  { minScore: 8, level: 'strong' },
  { minScore: 6, level: 'medium' },
  { minScore: 3, level: 'weak' },
  { minScore: 0, level: 'very-weak' }
];

export const PASSWORD_STRENGTH_LABELS: Readonly<Record<PasswordStrengthLevel, string>> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very strong'
};

export const PASSWORD_STRENGTH_RELATED_TOOLS: ReadonlyArray<StRelatedToolLink> = [
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Create a stronger unique password when this one scores low'
  },
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Compute a one-way digest when you need a checksum, not storage of plaintext'
  },
  {
    label: 'Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt',
    description: 'Protect notes or secrets with reversible encryption in the browser'
  },
  {
    label: 'UUID Generator',
    path: '/security-tools/uuid-generator',
    description: 'Generate random IDs when uniqueness matters more than memorability'
  }
];
