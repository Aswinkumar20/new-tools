import {
  PASSWORD_RULE_DEFAULT_FORM
} from '../constants/password-rule-validator.constants';
import {
  buildPasswordRuleChecklistText,
  evaluatePasswordRuleForm,
  evaluatePasswordRules,
  resolvePasswordRuleSuggestion
} from './password-rule-validator.utils';

describe('password-rule-validator.utils', () => {
  it('evaluates default empty password against all enabled rules', () => {
    const rules = evaluatePasswordRules(PASSWORD_RULE_DEFAULT_FORM);
    expect(rules).toHaveLength(7);
    expect(rules.find((rule) => rule.id === 'minLength')?.passed).toBe(false);
    expect(rules.find((rule) => rule.id === 'uppercase')?.passed).toBe(false);
    // Empty string has no spaces and is not on the common denylist
    expect(rules.find((rule) => rule.id === 'noSpaces')?.passed).toBe(true);
    expect(rules.find((rule) => rule.id === 'noCommon')?.passed).toBe(true);
  });

  it('passes a strong policy-compliant password', () => {
    const evaluation = evaluatePasswordRuleForm({
      ...PASSWORD_RULE_DEFAULT_FORM,
      password: 'CorrectHorseBattery!9'
    });
    expect(evaluation.allPassed).toBe(true);
    expect(evaluation.passedCount).toBe(evaluation.totalCount);
    expect(['strong', 'very-strong']).toContain(evaluation.strengthLevel);
  });

  it('detects common passwords when enabled', () => {
    const rules = evaluatePasswordRules({
      ...PASSWORD_RULE_DEFAULT_FORM,
      password: 'password',
      minLength: 8
    });
    expect(rules.find((rule) => rule.id === 'noCommon')?.passed).toBe(false);
  });

  it('omits disabled optional character rules', () => {
    const rules = evaluatePasswordRules({
      ...PASSWORD_RULE_DEFAULT_FORM,
      password: 'abcdefghijkl',
      requireUppercase: false,
      requireLowercase: true,
      requireNumber: false,
      requireSymbol: false,
      noSpaces: false,
      noCommon: false
    });
    expect(rules.map((rule) => rule.id)).toEqual(['minLength', 'lowercase']);
    expect(rules.every((rule) => rule.passed)).toBe(true);
  });

  it('builds checklist copy text', () => {
    const evaluation = evaluatePasswordRuleForm({
      ...PASSWORD_RULE_DEFAULT_FORM,
      password: 'Abcdefghijk1!'
    });
    const text = buildPasswordRuleChecklistText(evaluation);
    expect(text).toContain('Rules:');
    expect(text).toContain('Strength:');
    expect(text).toContain('Minimum length');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePasswordRuleSuggestion({
        hasInput: false,
        allPassed: false,
        failedRuleIds: [],
        strengthLevel: 'very-weak'
      })?.id
    ).toBe('prv-get-started');

    expect(
      resolvePasswordRuleSuggestion({
        hasInput: true,
        allPassed: false,
        failedRuleIds: ['noCommon', 'minLength'],
        strengthLevel: 'weak'
      })?.id
    ).toBe('prv-common');

    expect(
      resolvePasswordRuleSuggestion({
        hasInput: true,
        allPassed: false,
        failedRuleIds: ['symbol'],
        strengthLevel: 'medium'
      })?.id
    ).toBe('prv-failing');

    expect(
      resolvePasswordRuleSuggestion({
        hasInput: true,
        allPassed: true,
        failedRuleIds: [],
        strengthLevel: 'weak'
      })?.id
    ).toBe('prv-weak');

    expect(
      resolvePasswordRuleSuggestion({
        hasInput: true,
        allPassed: true,
        failedRuleIds: [],
        strengthLevel: 'strong'
      })?.id
    ).toBe('prv-pass');
  });
});
