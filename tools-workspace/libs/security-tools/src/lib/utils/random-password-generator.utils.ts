import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import {
  RANDOM_PASSWORD_AMBIGUOUS,
  RANDOM_PASSWORD_LOWERCASE,
  RANDOM_PASSWORD_MAX_LENGTH,
  RANDOM_PASSWORD_MIN_LENGTH,
  RANDOM_PASSWORD_NUMBERS,
  RANDOM_PASSWORD_STRENGTH_LABELS,
  RANDOM_PASSWORD_STRENGTH_ORDER,
  RANDOM_PASSWORD_SYMBOLS,
  RANDOM_PASSWORD_UPPERCASE
} from '../constants/random-password-generator.constants';
import type {
  GeneratedPassword,
  RandomPasswordFormValues,
  RandomPasswordGenerateResult,
  RandomPasswordStrengthLevel,
  RandomPasswordSuggestionContext
} from '../types/random-password-generator.types';

export function buildRandomPasswordCharset(options: RandomPasswordFormValues): string {
  let charset = '';
  if (options.includeLowercase) charset += RANDOM_PASSWORD_LOWERCASE;
  if (options.includeUppercase) charset += RANDOM_PASSWORD_UPPERCASE;
  if (options.includeNumbers) charset += RANDOM_PASSWORD_NUMBERS;
  if (options.includeSymbols) charset += RANDOM_PASSWORD_SYMBOLS;

  if (options.avoidAmbiguous) {
    charset = charset
      .split('')
      .filter((c) => !RANDOM_PASSWORD_AMBIGUOUS.includes(c))
      .join('');
  }

  return charset;
}

export function validateRandomPasswordOptions(options: RandomPasswordFormValues): string[] {
  const {
    length,
    includeLowercase,
    includeUppercase,
    includeNumbers,
    includeSymbols
  } = options;

  if (!includeLowercase && !includeUppercase && !includeNumbers && !includeSymbols) {
    return ['Select at least one character set to include.'];
  }

  if (length < RANDOM_PASSWORD_MIN_LENGTH || length > RANDOM_PASSWORD_MAX_LENGTH) {
    return ['Length should be between 4 and 128 characters.'];
  }

  const charset = buildRandomPasswordCharset(options);
  if (!charset) {
    return ['Character set is empty. Relax constraints or include more types.'];
  }

  return [];
}

export function generateRandomPassword(
  options: RandomPasswordFormValues
): RandomPasswordGenerateResult {
  const errors = validateRandomPasswordOptions(options);
  if (errors.length) {
    return { password: null, errors };
  }

  const charset = buildRandomPasswordCharset(options);
  const chars = charset.split('');
  const randomValues = new Uint32Array(options.length);
  crypto.getRandomValues(randomValues);

  let value = '';
  for (let i = 0; i < options.length; i++) {
    const index = randomValues[i] % chars.length;
    value += chars[index];
  }

  const password: GeneratedPassword = {
    value,
    createdAt: Date.now()
  };

  return { password, errors: [] };
}

/** Generator-local strength heuristic (distinct from Password Strength Checker). */
export function resolveGeneratedPasswordStrength(password: string): RandomPasswordStrengthLevel {
  if (!password) {
    return 'very-weak';
  }

  const lengthScore = Math.min(password.length / 4, 4);
  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore++;
  if (/[A-Z]/.test(password)) varietyScore++;
  if (/[0-9]/.test(password)) varietyScore++;
  if (/[^A-Za-z0-9]/.test(password)) varietyScore++;

  const score = lengthScore + varietyScore;
  if (score >= 7) return 'very-strong';
  if (score >= 6) return 'strong';
  if (score >= 4) return 'medium';
  if (score >= 2) return 'weak';
  return 'very-weak';
}

export function resolveGeneratedPasswordStrengthLabel(
  level: RandomPasswordStrengthLevel
): string {
  return RANDOM_PASSWORD_STRENGTH_LABELS[level];
}

export function resolveGeneratedPasswordStrengthPercent(
  level: RandomPasswordStrengthLevel
): number {
  const index = RANDOM_PASSWORD_STRENGTH_ORDER.indexOf(level);
  return ((index + 1) / RANDOM_PASSWORD_STRENGTH_ORDER.length) * 100;
}

export function formatGeneratedPasswordTime(createdAt: number | null): string {
  if (!createdAt) {
    return '—';
  }
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function resolveRandomPasswordSuggestion(
  context: RandomPasswordSuggestionContext
): StToolSuggestion | null {
  const { hasPassword, hasError, errorMessage, length, strengthLevel } = context;

  if (hasError && errorMessage?.includes('character set')) {
    return {
      id: 'rpg-charset',
      title: 'No usable characters selected',
      reason:
        'Enable at least one character type, or turn off Avoid ambiguous if it emptied the pool.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (hasError && errorMessage?.includes('Length should')) {
    return {
      id: 'rpg-length-range',
      title: 'Length is out of range',
      reason: 'Use a length between 4 and 128. 16+ characters is a solid default for most accounts.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (!hasPassword) {
    return {
      id: 'rpg-get-started',
      title: 'Ready to generate a password?',
      reason:
        'Adjust length and character sets in Options, then Generate. Randomness comes from crypto.getRandomValues.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (length < 12 || strengthLevel === 'very-weak' || strengthLevel === 'weak') {
    return {
      id: 'rpg-short',
      title: 'Consider a longer password',
      reason:
        'Increase length (16+) and keep multiple character types enabled, then re-check strength in detail.',
      actionLabel: 'Open Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (strengthLevel === 'strong' || strengthLevel === 'very-strong') {
    return {
      id: 'rpg-private-notes',
      title: 'Use it to lock a private note?',
      reason:
        'Private Notes can encrypt text with this passphrase for the current browser session.',
      actionLabel: 'Open Private Notes',
      path: '/security-tools/private-notes'
    };
  }

  return {
    id: 'rpg-verify',
    title: 'Verify this password’s strength?',
    reason:
      'Password Strength Checker gives a tip breakdown you can compare with the meter here.',
    actionLabel: 'Open Strength Checker',
    path: '/security-tools/password-strength-checker'
  };
}
