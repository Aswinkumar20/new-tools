import type { TtToolSuggestion } from '../shared/tt-tool-suggestion.model';
import {
  PASSWORD_RULE_BASE_RULES,
  PASSWORD_RULE_COMMON_PASSWORDS,
  PASSWORD_RULE_STRENGTH_LABELS,
  PASSWORD_RULE_STRENGTH_LEVELS
} from '../constants/password-rule-validator.constants';
import type {
  PasswordRuleConfig,
  PasswordRuleEvaluation,
  PasswordRuleFormValues,
  PasswordRuleStatus,
  PasswordRuleStrengthLevel,
  PasswordRuleSuggestionContext
} from '../types/password-rule-validator.types';

const RULE_BY_ID: ReadonlyMap<string, PasswordRuleConfig> = new Map(
  PASSWORD_RULE_BASE_RULES.map((rule) => [rule.id, rule])
);

function ruleConfig(id: string): PasswordRuleConfig {
  const config = RULE_BY_ID.get(id);
  if (!config) {
    throw new Error(`Unknown password rule id: ${id}`);
  }
  return config;
}

export function evaluatePasswordRules(
  values: PasswordRuleFormValues
): PasswordRuleStatus[] {
  const {
    password: pwd,
    minLength,
    requireUppercase,
    requireLowercase,
    requireNumber,
    requireSymbol,
    noSpaces,
    noCommon
  } = values;

  const statuses: PasswordRuleStatus[] = [];

  statuses.push({
    ...ruleConfig('minLength'),
    passed: pwd.length >= minLength
  });

  if (requireUppercase) {
    statuses.push({
      ...ruleConfig('uppercase'),
      passed: /[A-Z]/.test(pwd)
    });
  }

  if (requireLowercase) {
    statuses.push({
      ...ruleConfig('lowercase'),
      passed: /[a-z]/.test(pwd)
    });
  }

  if (requireNumber) {
    statuses.push({
      ...ruleConfig('number'),
      passed: /[0-9]/.test(pwd)
    });
  }

  if (requireSymbol) {
    statuses.push({
      ...ruleConfig('symbol'),
      passed: /[^A-Za-z0-9\s]/.test(pwd)
    });
  }

  if (noSpaces) {
    statuses.push({
      ...ruleConfig('noSpaces'),
      passed: !/\s/.test(pwd)
    });
  }

  if (noCommon) {
    const lower = pwd.toLowerCase();
    statuses.push({
      ...ruleConfig('noCommon'),
      passed: !PASSWORD_RULE_COMMON_PASSWORDS.includes(lower)
    });
  }

  return statuses;
}

export function computePasswordRuleStrength(
  password: string,
  rules: PasswordRuleStatus[]
): PasswordRuleStrengthLevel {
  if (!password) {
    return 'very-weak';
  }

  const lengthScore = Math.min(password.length / 4, 4);
  let varietyScore = 0;
  if (/[A-Z]/.test(password)) varietyScore++;
  if (/[a-z]/.test(password)) varietyScore++;
  if (/[0-9]/.test(password)) varietyScore++;
  if (/[^A-Za-z0-9\s]/.test(password)) varietyScore++;

  const totalCount = rules.length;
  const passedCount = rules.filter((rule) => rule.passed).length;
  const ruleScore = totalCount === 0 ? 0 : (passedCount / totalCount) * 4;

  const score = lengthScore + varietyScore + ruleScore;

  if (score >= 10) return 'very-strong';
  if (score >= 8) return 'strong';
  if (score >= 6) return 'medium';
  if (score >= 3) return 'weak';
  return 'very-weak';
}

export function strengthPercentForLevel(level: PasswordRuleStrengthLevel): number {
  const index = PASSWORD_RULE_STRENGTH_LEVELS.indexOf(level);
  return ((index + 1) / PASSWORD_RULE_STRENGTH_LEVELS.length) * 100;
}

export function evaluatePasswordRuleForm(
  values: PasswordRuleFormValues
): PasswordRuleEvaluation {
  const rules = evaluatePasswordRules(values);
  const passedCount = rules.filter((rule) => rule.passed).length;
  const totalCount = rules.length;
  const hasInput = !!values.password.length;
  const strengthLevel = computePasswordRuleStrength(values.password, rules);

  return {
    rules,
    passedCount,
    totalCount,
    strengthLevel,
    strengthLabel: PASSWORD_RULE_STRENGTH_LABELS[strengthLevel],
    strengthPercent: strengthPercentForLevel(strengthLevel),
    allPassed: hasInput && passedCount === totalCount && totalCount > 0
  };
}

export function buildPasswordRuleChecklistText(evaluation: PasswordRuleEvaluation): string {
  const lines = evaluation.rules.map(
    (rule) => `${rule.passed ? '✓' : '✗'} ${rule.label}: ${rule.description}`
  );
  lines.unshift(`Strength: ${evaluation.strengthLabel}`);
  lines.unshift(`Rules: ${evaluation.passedCount}/${evaluation.totalCount} passed`);
  return lines.join('\n');
}

export function resolvePasswordRuleSuggestion(
  context: PasswordRuleSuggestionContext
): TtToolSuggestion | null {
  const { hasInput, allPassed, failedRuleIds, strengthLevel } = context;

  if (!hasInput) {
    return {
      id: 'prv-get-started',
      title: 'Need a password that passes policy?',
      reason:
        'Type a candidate to test live rules, or generate a strong unique password and paste it here.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (failedRuleIds.includes('noCommon')) {
    return {
      id: 'prv-common',
      title: 'Common password detected',
      reason:
        'This value appears on a short denylist of very common passwords. Generate a unique one instead.',
      actionLabel: 'Open Password Generator',
      path: '/security-tools/random-password-generator'
    };
  }

  if (!allPassed) {
    return {
      id: 'prv-failing',
      title: 'Some policy rules are failing',
      reason:
        'Adjust the password to satisfy the checklist, or tweak Requirements in Options to match your org policy.',
      actionLabel: 'Open Password Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  if (strengthLevel === 'very-weak' || strengthLevel === 'weak') {
    return {
      id: 'prv-weak',
      title: 'Rules pass, but strength looks low',
      reason:
        'Policy compliance is not the same as entropy. Review a fuller strength breakdown or generate a longer password.',
      actionLabel: 'Open Password Strength Checker',
      path: '/security-tools/password-strength-checker'
    };
  }

  return {
    id: 'prv-pass',
    title: 'Password meets configured rules',
    reason:
      'Next, inspect overall strength or encrypt notes with a strong passphrase — still keep secrets out of plaintext storage.',
    actionLabel: 'Open Password Strength Checker',
    path: '/security-tools/password-strength-checker'
  };
}
