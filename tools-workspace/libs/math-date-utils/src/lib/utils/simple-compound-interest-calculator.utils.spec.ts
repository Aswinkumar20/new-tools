import {
  calculateInterest,
  estimateTimeForGoal,
  formatInterestCurrency,
  resolveInterestSuggestion,
  toNumber
} from './simple-compound-interest-calculator.utils';

describe('simple-compound-interest-calculator.utils', () => {
  describe('toNumber', () => {
    it('parses comma-separated amounts', () => {
      expect(toNumber('1,250.5')).toBe(1250.5);
      expect(toNumber('')).toBe(0);
      expect(toNumber(42)).toBe(42);
    });
  });

  describe('calculateInterest', () => {
    const base = {
      principal: 10000,
      rate: 0.075,
      time: 5,
      frequency: 'annually' as const,
      contributions: 0,
      contributionFrequency: 'monthly' as const,
      includeTimeline: true,
      includeBreakdown: true
    };

    it('computes simple interest', () => {
      const result = calculateInterest({ ...base, mode: 'simple' });
      expect(result.summary.futureValue).toBeCloseTo(13750);
      expect(result.summary.interestEarned).toBeCloseTo(3750);
      expect(result.summary.totalContributions).toBe(0);
      expect(result.timeline?.length).toBeGreaterThan(0);
    });

    it('computes compound interest', () => {
      const result = calculateInterest({ ...base, mode: 'compound' });
      expect(result.summary.futureValue).toBeGreaterThan(10000);
      expect(result.summary.interestEarned).toBeGreaterThan(0);
      expect(result.breakdown?.totalPrincipal).toBe(10000);
    });

    it('includes contribution growth for compound mode', () => {
      const result = calculateInterest({
        ...base,
        mode: 'compound',
        contributions: 100,
        contributionFrequency: 'monthly'
      });
      expect(result.summary.totalContributions).toBeGreaterThan(0);
      expect(result.summary.futureValue).toBeGreaterThan(base.principal);
    });

    it('rejects negative inputs', () => {
      expect(() => calculateInterest({ ...base, mode: 'compound', principal: -1 })).toThrow(
        'non-negative'
      );
    });

    it('derives goal progress when target is set', () => {
      const result = calculateInterest({
        ...base,
        mode: 'compound',
        targetAmount: 20000
      });
      expect(result.goalProgress?.targetAmount).toBe(20000);
      expect(typeof result.goalProgress?.reached).toBe('boolean');
    });
  });

  describe('estimateTimeForGoal', () => {
    it('estimates compound years to reach a target', () => {
      const years = estimateTimeForGoal(10000, 0.07, 20000);
      expect(years).toBeGreaterThan(5);
      expect(years).toBeLessThan(15);
    });
  });

  describe('formatInterestCurrency', () => {
    it('formats as USD currency', () => {
      expect(formatInterestCurrency(12.5)).toContain('12.50');
    });
  });

  describe('resolveInterestSuggestion', () => {
    it('suggests validation help on errors', () => {
      expect(
        resolveInterestSuggestion({
          hasResult: false,
          hasError: true,
          mode: 'compound',
          ratePercent: 5,
          timeYears: 5,
          contributions: 0,
          hasTarget: false,
          goalReached: false,
          principal: 1000
        })?.id
      ).toBe('sic-validation');
    });

    it('suggests EMI for simple interest', () => {
      expect(
        resolveInterestSuggestion({
          hasResult: true,
          hasError: false,
          mode: 'simple',
          ratePercent: 5,
          timeYears: 2,
          contributions: 0,
          hasTarget: false,
          goalReached: false,
          principal: 12000
        })?.id
      ).toBe('sic-simple');
    });

    it('suggests wording help when contributions are active', () => {
      expect(
        resolveInterestSuggestion({
          hasResult: true,
          hasError: false,
          mode: 'compound',
          ratePercent: 6.5,
          timeYears: 25,
          contributions: 500,
          hasTarget: true,
          goalReached: false,
          principal: 25000
        })?.id
      ).toBe('sic-contributions');
    });
  });
});
