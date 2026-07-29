import type { StToolSuggestion } from '../shared/st-tool-suggestion.model';
import {
  PASSWORD_STRENGTH_COMMON_PATTERN,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_LENGTH_THRESHOLDS,
  PASSWORD_STRENGTH_LEVEL_THRESHOLDS,
  PASSWORD_STRENGTH_MAX_SCORE,
  PASSWORD_STRENGTH_REPEAT_PATTERN
} from '../constants/password-strength-checker.constants';
import type {
  PasswordStrengthAnalysis,
  PasswordStrengthBreakdown,
  PasswordStrengthLevel,
  PasswordStrengthSuggestionContext
} from '../types/password-strength-checker.types';

export function analyzePasswordStrength(password: string): PasswordStrengthAnalysis {
  const breakdown = computeStrengthBreakdown(password);
  const score = breakdown.lengthScore + breakdown.varietyScore + breakdown.bonusScore;
  const level = resolveStrengthLevel(score);

  return {
    breakdown,
    score,
    level,
    label: PASSWORD_STRENGTH_LABELS[level],
    percent: computeStrengthPercent(score),
    tips: buildPasswordImprovementTips(password)
  };
}

export function computeStrengthBreakdown(password: string): PasswordStrengthBreakdown {
  if (!password) {
    return { lengthScore: 0, varietyScore: 0, bonusScore: 0 };
  }

  let lengthScore = 0;
  for (const threshold of PASSWORD_STRENGTH_LENGTH_THRESHOLDS) {
    if (password.length >= threshold) {
      lengthScore++;
    }
  }

  let varietyScore = 0;
  if (/[a-z]/.test(password)) varietyScore++;
  if (/[A-Z]/.test(password)) varietyScore++;
  if (/[0-9]/.test(password)) varietyScore++;
  if (/[^A-Za-z0-9]/.test(password)) varietyScore++;

  let bonusScore = 0;
  if (!PASSWORD_STRENGTH_REPEAT_PATTERN.test(password)) {
    bonusScore++;
  }
  if (!PASSWORD_STRENGTH_COMMON_PATTERN.test(password)) {
    bonusScore++;
  }

  return { lengthScore, varietyScore, bonusScore };
}

export function resolveStrengthLevel(score: number): PasswordStrengthLevel {
  for (const entry of PASSWORD_STRENGTH_LEVEL_THRESHOLDS) {
    if (score >= entry.minScore) {
      return entry.level;
    }
  }
  return 'very-weak';
}

export function computeStrengthPercent(
  score: number,
  maxScore: number = PASSWORD_STRENGTH_MAX_SCORE
): number {
  const clamped = Math.min(score, maxScore);
  return (clamped / maxScore) * 100;
}

export function buildPasswordImprovementTips(password: string): string[] {
  const tips: string[] = [];

  if (!password) {
    tips.push('Start typing a password to see suggestions.');
    return tips;
  }

  if (password.length < 12) {
    tips.push('Use at least 12 characters for better security.');
  }
  if (!/[a-z]/.test(password)) {
    tips.push('Add lowercase letters (a–z).');
  }
  if (!/[A-Z]/.test(password)) {
    tips.push('Add uppercase letters (A–Z).');
  }
  if (!/[0-9]/.test(password)) {
    tips.push('Add numbers (0–9).');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    tips.push('Add symbols (e.g. !@#$%^&*).');
  }
  if (PASSWORD_STRENGTH_REPEAT_PATTERN.test(password)) {
    tips.push('Avoid repeating the same character several times in a row.');
  }
  if (PASSWORD_STRENGTH_COMMON_PATTERN.test(password)) {
    tips.push('Avoid obvious sequences or common passwords.');
  }

  if (tips.length === 0) {
    tips.push(
      'This password looks strong. Consider using a password manager to store it safely.'
    );
  }

  return tips;
}

export function resolvePasswordStrengthSuggestion(
  context: PasswordStrengthSuggestionContext
): StToolSuggestion | null {
  const { hasPassword, level, score } = context;

  if (!hasPassword) {
    return {
      id: 'psc-generate',
      title: 'Need a strong password?',
      reason:
        'Random Password Generator can create a unique high-entropy secret you can then re-check here.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (level === 'very-weak' || level === 'weak' || score < 6) {
    return {
      id: 'psc-weak',
      title: 'Password looks easy to guess',
      reason:
        'Generate a longer random password, then paste it back here to confirm the score improved.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (level === 'strong' || level === 'very-strong') {
    return {
      id: 'psc-hash',
      title: 'Storing a checksum instead of plaintext?',
      reason:
        'Hash Generator can produce a one-way digest for demo checksums — never store passwords as plain hashes without a proper KDF.',
      actionLabel: 'Open Hash Generator',
      path: '/security-tools/hash-generator'
    };
  }

  return {
    id: 'psc-encrypt',
    title: 'Protect related notes?',
    reason:
      'Text Encrypt / Decrypt can lock sensitive notes locally while you refine password hygiene.',
    actionLabel: 'Open Text Encrypt / Decrypt',
    path: '/security-tools/text-encrypt-decrypt'
  };
}
