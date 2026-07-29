import {
  formatFractionDisplay,
  formatMixedDisplay,
  gcd,
  lcm,
  performFractionOperation,
  resolveFractionSuggestion,
  simplifyFraction,
  toMixedFraction
} from './fraction-calculator.utils';

describe('fraction-calculator.utils', () => {
  describe('performFractionOperation', () => {
    it('adds and simplifies fractions', () => {
      const result = performFractionOperation(
        { numerator: 3, denominator: 4 },
        { numerator: 2, denominator: 5 },
        'add',
        { autoSimplify: true, showSteps: true, precision: 4 }
      );
      expect(result.simplified).toEqual({ numerator: 23, denominator: 20 });
      expect(result.decimalFormatted).toBe('1.1500');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.mixed?.whole).toBe(1);
    });

    it('divides by multiplying the reciprocal', () => {
      const result = performFractionOperation(
        { numerator: 7, denominator: 10 },
        { numerator: 1, denominator: 5 },
        'divide',
        { autoSimplify: true, showSteps: false, precision: 2 }
      );
      expect(result.simplified).toEqual({ numerator: 7, denominator: 2 });
    });

    it('rejects division by a zero numerator', () => {
      expect(() =>
        performFractionOperation(
          { numerator: 1, denominator: 2 },
          { numerator: 0, denominator: 3 },
          'divide',
          { autoSimplify: true, showSteps: false, precision: 4 }
        )
      ).toThrow('Cannot divide by a fraction with a zero numerator.');
    });
  });

  describe('helpers', () => {
    it('computes gcd/lcm and mixed forms', () => {
      expect(gcd(12, 18)).toBe(6);
      expect(lcm(4, 6)).toBe(12);
      expect(simplifyFraction({ numerator: 10, denominator: -15 })).toEqual({
        numerator: -2,
        denominator: 3
      });
      expect(formatFractionDisplay({ numerator: 1, denominator: 2 })).toBe('1/2');
      expect(formatMixedDisplay({ sign: -1, whole: 1, numerator: 1, denominator: 2 })).toBe(
        '−1 1/2'
      );
      expect(toMixedFraction({ numerator: 9, denominator: 4 })?.whole).toBe(2);
    });
  });

  describe('resolveFractionSuggestion', () => {
    it('prioritizes validation and whole-number results', () => {
      expect(
        resolveFractionSuggestion({
          hasResult: false,
          hasError: true,
          operation: 'add',
          autoSimplify: true,
          isWholeNumber: false,
          isImproper: false,
          canSimplifyFurther: false
        })?.id
      ).toBe('fc-validation');

      expect(
        resolveFractionSuggestion({
          hasResult: true,
          hasError: false,
          operation: 'add',
          autoSimplify: true,
          isWholeNumber: true,
          isImproper: false,
          canSimplifyFurther: false
        })?.id
      ).toBe('fc-whole');
    });

    it('suggests simplify guidance when auto simplify is off', () => {
      expect(
        resolveFractionSuggestion({
          hasResult: true,
          hasError: false,
          operation: 'add',
          autoSimplify: false,
          isWholeNumber: false,
          isImproper: false,
          canSimplifyFurther: true
        })?.id
      ).toBe('fc-simplify-off');
    });
  });
});
