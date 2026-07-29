import {
  analyzePasswordStrength,
  buildPasswordImprovementTips,
  computeStrengthBreakdown,
  computeStrengthPercent,
  resolvePasswordStrengthSuggestion,
  resolveStrengthLevel
} from './password-strength-checker.utils';

describe('password-strength-checker.utils', () => {
  it('returns empty breakdown for blank passwords', () => {
    expect(computeStrengthBreakdown('')).toEqual({
      lengthScore: 0,
      varietyScore: 0,
      bonusScore: 0
    });
    expect(buildPasswordImprovementTips('')[0]).toContain('Start typing');
  });

  it('penalizes common and repeating patterns', () => {
    const common = analyzePasswordStrength('password');
    expect(common.breakdown.bonusScore).toBeLessThan(2);
    expect(common.tips.some((t) => t.includes('common passwords'))).toBe(true);

    const repeats = analyzePasswordStrength('aaaBBB111!!!');
    expect(repeats.tips.some((t) => t.includes('repeating'))).toBe(true);
  });

  it('rewards length and variety', () => {
    const strong = analyzePasswordStrength('Tr0ub4dor&3xtraLong!');
    expect(strong.breakdown.lengthScore).toBeGreaterThanOrEqual(3);
    expect(strong.breakdown.varietyScore).toBe(4);
    expect(strong.percent).toBeGreaterThan(50);
    expect(resolveStrengthLevel(10)).toBe('very-strong');
    expect(computeStrengthPercent(6)).toBe(50);
  });

  it('resolves cross-tool suggestions by strength', () => {
    expect(
      resolvePasswordStrengthSuggestion({
        hasPassword: false,
        level: 'very-weak',
        score: 0
      })?.id
    ).toBe('psc-generate');

    expect(
      resolvePasswordStrengthSuggestion({
        hasPassword: true,
        level: 'weak',
        score: 4
      })?.id
    ).toBe('psc-weak');

    expect(
      resolvePasswordStrengthSuggestion({
        hasPassword: true,
        level: 'very-strong',
        score: 11
      })?.id
    ).toBe('psc-hash');

    expect(
      resolvePasswordStrengthSuggestion({
        hasPassword: true,
        level: 'medium',
        score: 7
      })?.id
    ).toBe('psc-encrypt');
  });
});
