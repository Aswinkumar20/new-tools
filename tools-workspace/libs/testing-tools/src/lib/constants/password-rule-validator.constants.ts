import type { TtRelatedToolLink } from '../shared/tt-tool-suggestion.model';
import type {
  PasswordRuleConfig,
  PasswordRuleFormValues,
  PasswordRuleStrengthLevel
} from '../types/password-rule-validator.types';

export const PASSWORD_RULE_DEFAULT_FORM: PasswordRuleFormValues = {
  password: '',
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  noSpaces: true,
  noCommon: true
};

export const PASSWORD_RULE_COMMON_PASSWORDS: ReadonlyArray<string> = [
  'password',
  '123456',
  '123456789',
  'qwerty',
  '12345678',
  '111111',
  '123123',
  'password1',
  'iloveyou'
];

export const PASSWORD_RULE_BASE_RULES: ReadonlyArray<PasswordRuleConfig> = [
  {
    id: 'minLength',
    label: 'Minimum length',
    description: 'Password should meet the minimum length requirement.',
    enabled: true
  },
  {
    id: 'uppercase',
    label: 'Uppercase letter',
    description: 'At least one uppercase letter (A–Z).',
    enabled: true
  },
  {
    id: 'lowercase',
    label: 'Lowercase letter',
    description: 'At least one lowercase letter (a–z).',
    enabled: true
  },
  {
    id: 'number',
    label: 'Number',
    description: 'At least one digit (0–9).',
    enabled: true
  },
  {
    id: 'symbol',
    label: 'Symbol',
    description: 'At least one symbol (e.g. !@#$%^&*).',
    enabled: true
  },
  {
    id: 'noSpaces',
    label: 'No spaces',
    description: 'Password should not contain spaces.',
    enabled: true
  },
  {
    id: 'noCommon',
    label: 'Not common',
    description: 'Password should not be a very common password.',
    enabled: true
  }
];

export const PASSWORD_RULE_STRENGTH_LEVELS: ReadonlyArray<PasswordRuleStrengthLevel> = [
  'very-weak',
  'weak',
  'medium',
  'strong',
  'very-strong'
];

export const PASSWORD_RULE_STRENGTH_LABELS: Readonly<
  Record<PasswordRuleStrengthLevel, string>
> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very strong'
};

export const PASSWORD_RULE_RELATED_TOOLS: ReadonlyArray<TtRelatedToolLink> = [
  {
    label: 'Password Strength Checker',
    path: '/security-tools/password-strength-checker',
    description: 'Get a deeper entropy-style strength breakdown for the same password'
  },
  {
    label: 'Random Password Generator',
    path: '/security-tools/random-password-generator',
    description: 'Generate a policy-friendly password when rules keep failing'
  },
  {
    label: 'Hash Generator',
    path: '/security-tools/hash-generator',
    description: 'Hash secrets for checksums — never store plaintext passwords'
  },
  {
    label: 'Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt',
    description: 'Protect notes with a strong passphrase derived key locally'
  }
];
