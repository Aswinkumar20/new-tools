import {
  computePercentage,
  formatPercentageNumber,
  resolvePercentageSuggestion,
  toNumber
} from './percentage-calculator.utils';

describe('percentage-calculator.utils', () => {
  describe('toNumber', () => {
    it('parses comma-separated strings', () => {
      expect(toNumber('1,250.5')).toBe(1250.5);
      expect(toNumber('')).toBe(0);
      expect(toNumber(42)).toBe(42);
    });
  });

  describe('formatPercentageNumber', () => {
    it('formats with decimal places and rounding', () => {
      expect(formatPercentageNumber(12.3456, 2, false)).toBe('12.35');
      expect(formatPercentageNumber(12.6, 2, true)).toBe('13');
    });
  });

  describe('computePercentage', () => {
    const base = {
      baseValue: 120,
      percentageValue: 20,
      resultValue: 24,
      increaseDecreaseValue: 15,
      includeDifference: true,
      showSteps: true
    };

    it('computes percentage of a value', () => {
      const result = computePercentage({ ...base, mode: 'percentageOf' });
      expect(result.value).toBe(24);
      expect(result.difference).toBe(24);
      expect(result.steps?.length).toBe(3);
    });

    it('computes what percent of', () => {
      const result = computePercentage({ ...base, mode: 'isWhatPercent', resultValue: 30 });
      expect(result.value).toBe(25);
    });

    it('rejects zero base for isWhatPercent', () => {
      expect(() =>
        computePercentage({ ...base, mode: 'isWhatPercent', baseValue: 0 })
      ).toThrow('Base value cannot be zero');
    });

    it('computes percentage change', () => {
      const result = computePercentage({
        ...base,
        mode: 'percentageChange',
        baseValue: 100,
        resultValue: 125
      });
      expect(result.value).toBe(25);
      expect(result.difference).toBe(25);
    });

    it('computes increase and decrease', () => {
      const increase = computePercentage({ ...base, mode: 'percentageIncrease' });
      expect(increase.value).toBe(144);
      const decrease = computePercentage({ ...base, mode: 'percentageDecrease' });
      expect(decrease.value).toBe(96);
    });
  });

  describe('resolvePercentageSuggestion', () => {
    it('suggests tip calculator for tip-range percentageOf', () => {
      expect(
        resolvePercentageSuggestion({
          hasResult: true,
          hasError: false,
          mode: 'percentageOf',
          percentageValue: 18,
          baseValue: 56.4,
          resultValue: 0
        })?.id
      ).toBe('pc-tip');
    });

    it('suggests validation help on errors', () => {
      expect(
        resolvePercentageSuggestion({
          hasResult: false,
          hasError: true,
          mode: 'isWhatPercent',
          percentageValue: 0,
          baseValue: 0,
          resultValue: 10
        })?.id
      ).toBe('pc-validation');
    });

    it('suggests fraction tool for progress mode', () => {
      expect(
        resolvePercentageSuggestion({
          hasResult: true,
          hasError: false,
          mode: 'isWhatPercent',
          percentageValue: 0,
          baseValue: 200,
          resultValue: 65
        })?.id
      ).toBe('pc-progress');
    });
  });
});
