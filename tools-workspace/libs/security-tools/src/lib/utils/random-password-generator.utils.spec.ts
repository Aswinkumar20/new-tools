import { webcrypto } from 'crypto';
import { RANDOM_PASSWORD_DEFAULT_FORM } from '../constants/random-password-generator.constants';
import {
  buildRandomPasswordCharset,
  generateRandomPassword,
  resolveGeneratedPasswordStrength,
  resolveGeneratedPasswordStrengthPercent,
  resolveRandomPasswordSuggestion,
  validateRandomPasswordOptions
} from './random-password-generator.utils';

describe('random-password-generator.utils', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  });

  it('validates options and builds charset', () => {
    expect(
      validateRandomPasswordOptions({
        ...RANDOM_PASSWORD_DEFAULT_FORM,
        includeLowercase: false,
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: false
      })[0]
    ).toContain('at least one character set');

    expect(
      validateRandomPasswordOptions({
        ...RANDOM_PASSWORD_DEFAULT_FORM,
        length: 200
      })[0]
    ).toContain('between 4 and 128');

    const charset = buildRandomPasswordCharset(RANDOM_PASSWORD_DEFAULT_FORM);
    expect(charset.length).toBeGreaterThan(10);
    expect(charset.includes('O')).toBe(false);
    expect(charset.includes('0')).toBe(false);
  });

  it('generates passwords of the requested length', () => {
    const { password, errors } = generateRandomPassword({
      ...RANDOM_PASSWORD_DEFAULT_FORM,
      length: 24
    });
    expect(errors).toEqual([]);
    expect(password?.value).toHaveLength(24);
  });

  it('scores strength with the generator heuristic', () => {
    expect(resolveGeneratedPasswordStrength('')).toBe('very-weak');
    expect(resolveGeneratedPasswordStrength('Ab1!Ab1!Ab1!Ab1!')).toBe('very-strong');
    expect(resolveGeneratedPasswordStrengthPercent('medium')).toBe(60);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveRandomPasswordSuggestion({
        hasPassword: false,
        hasError: false,
        errorMessage: null,
        length: 16,
        strengthLevel: 'very-weak'
      })?.id
    ).toBe('rpg-get-started');

    expect(
      resolveRandomPasswordSuggestion({
        hasPassword: false,
        hasError: true,
        errorMessage: 'Select at least one character set to include.',
        length: 16,
        strengthLevel: 'very-weak'
      })?.id
    ).toBe('rpg-charset');

    expect(
      resolveRandomPasswordSuggestion({
        hasPassword: true,
        hasError: false,
        errorMessage: null,
        length: 8,
        strengthLevel: 'medium'
      })?.id
    ).toBe('rpg-short');

    expect(
      resolveRandomPasswordSuggestion({
        hasPassword: true,
        hasError: false,
        errorMessage: null,
        length: 16,
        strengthLevel: 'very-strong'
      })?.id
    ).toBe('rpg-private-notes');
  });
});
