import {
  calculateBmi,
  convertUnits,
  formatBmiResultText,
  formatHeightDisplay,
  formatWeightDisplay,
  hasHighWaistRisk,
  mapBmiCalculationError,
  prependBmiHistory,
  resolveBmiSuggestion,
  resolveCategory,
  toNumber
} from './bmi-calculator.utils';
import type { BmiHistory } from '../types/bmi-calculator.types';

describe('bmi-calculator.utils', () => {
  describe('calculateBmi', () => {
    it('computes a healthy metric BMI', () => {
      const result = calculateBmi({
        unit: 'metric',
        weight: 70,
        height: 175,
        gender: 'unspecified'
      });

      expect(result.summary.bmi).toBe(22.9);
      expect(result.summary.classification.id).toBe('healthy');
      expect(result.breakdown?.weightKg).toBe(70);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('rejects non-positive measurements', () => {
      expect(() =>
        calculateBmi({
          unit: 'metric',
          weight: 0,
          height: 170,
          gender: 'male'
        })
      ).toThrow('Weight and height must be positive values.');
    });

    it('adds waist and age guidance when relevant', () => {
      const result = calculateBmi({
        unit: 'metric',
        weight: 95,
        height: 175,
        age: 55,
        gender: 'male',
        waist: 110
      });

      expect(result.summary.classification.id).toBe('obesity');
      expect(result.riskIndicators.some((risk) => risk.label === 'Central adiposity')).toBe(true);
      expect(result.recommendations.some((tip) => tip.includes('age-related'))).toBe(true);
    });
  });

  describe('convertUnits', () => {
    it('converts metric to imperial and back', () => {
      const imperial = convertUnits({ from: 'metric', to: 'imperial', weight: 70, height: 175 });
      expect(imperial.weight).toBeCloseTo(154.3, 0);
      expect(imperial.height).toBeCloseTo(68.9, 0);

      const metric = convertUnits({
        from: 'imperial',
        to: 'metric',
        weight: imperial.weight,
        height: imperial.height
      });
      expect(metric.weight).toBeCloseTo(70, 0);
      expect(metric.height).toBeCloseTo(175, 0);
    });
  });

  describe('formatting helpers', () => {
    it('formats weight and height for both unit systems', () => {
      expect(formatWeightDisplay(70, 'metric')).toBe('70.0 kg');
      expect(formatWeightDisplay(70, 'imperial')).toContain('lb');
      expect(formatHeightDisplay(175, 'metric')).toBe('175.0 cm');
      expect(formatHeightDisplay(175, 'imperial')).toContain('in');
    });

    it('formats copyable result text', () => {
      const result = calculateBmi({
        unit: 'metric',
        weight: 70,
        height: 175,
        gender: 'female'
      });
      const text = formatBmiResultText(result);
      expect(text).toContain('BMI:');
      expect(text).toContain('Classification:');
      expect(text).toContain('Ideal range:');
    });
  });

  describe('history and parsing', () => {
    it('parses numeric strings and prepends history', () => {
      expect(toNumber('1,234.5')).toBe(1234.5);
      expect(toNumber('')).toBe(0);

      const result = calculateBmi({
        unit: 'metric',
        weight: 70,
        height: 175,
        gender: 'unspecified'
      });
      const entry = (weight: number): BmiHistory => ({
        ...result,
        unit: 'metric',
        weight,
        height: 175,
        gender: 'unspecified'
      });

      const next = prependBmiHistory([entry(70)], entry(72), 2);
      expect(next).toHaveLength(2);
      expect(next[0].weight).toBe(72);
    });
  });

  describe('resolveBmiSuggestion', () => {
    it('prioritizes validation errors', () => {
      expect(
        resolveBmiSuggestion({
          hasResult: false,
          hasError: true,
          categoryId: null,
          hasWaist: false,
          hasHighWaistRisk: false,
          unit: 'metric'
        })?.id
      ).toBe('bmi-positive-values');
    });

    it('suggests youth guidance for under-18 ages', () => {
      expect(
        resolveBmiSuggestion({
          hasResult: true,
          hasError: false,
          categoryId: 'healthy',
          age: 16,
          hasWaist: false,
          hasHighWaistRisk: false,
          unit: 'metric'
        })?.id
      ).toBe('bmi-teen');
    });

    it('suggests percentage tools for clinical categories', () => {
      expect(
        resolveBmiSuggestion({
          hasResult: true,
          hasError: false,
          categoryId: 'obesity',
          age: 40,
          hasWaist: false,
          hasHighWaistRisk: false,
          unit: 'metric'
        })?.id
      ).toBe('bmi-clinical');
    });
  });

  describe('misc helpers', () => {
    it('resolves categories and waist risk', () => {
      expect(resolveCategory(22).id).toBe('healthy');
      expect(resolveCategory(40).id).toBe('severe');
      expect(hasHighWaistRisk({ gender: 'female', waist: 90 })).toBe(true);
      expect(hasHighWaistRisk({ gender: 'male', waist: 90 })).toBe(false);
      expect(mapBmiCalculationError(new Error('x'))).toBe('x');
      expect(mapBmiCalculationError(null)).toBe('Unable to calculate BMI.');
    });
  });
});
