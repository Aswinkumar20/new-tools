import { createDefaultConversionEngine, formatUnitNumber, resolveUnitSuggestion } from './unit-converter.utils';

describe('unit-converter.utils', () => {
  const engine = createDefaultConversionEngine();

  describe('ConversionEngine', () => {
    it('converts meters to feet', () => {
      const result = engine.convert(1, 'meter', 'foot');
      expect(result.outputValue).toBeCloseTo(3.280839895, 5);
      expect(result.inputUnit.id).toBe('meter');
      expect(result.outputUnit.id).toBe('foot');
    });

    it('converts celsius to fahrenheit', () => {
      const result = engine.convert(0, 'celsius', 'fahrenheit');
      expect(result.outputValue).toBeCloseTo(32, 5);
      expect(result.formula).toContain('9');
    });

    it('rejects mismatched categories', () => {
      expect(() => engine.convert(1, 'meter', 'kilogram')).toThrow('Mismatched');
    });

    it('rejects invalid values', () => {
      expect(() => engine.convert(Number.NaN, 'meter', 'foot')).toThrow('Invalid');
    });
  });

  describe('formatUnitNumber', () => {
    it('formats finite numbers', () => {
      expect(formatUnitNumber(1.23456789, 4)).toContain('1.2346');
      expect(formatUnitNumber(Number.POSITIVE_INFINITY)).toBe('—');
    });
  });

  describe('resolveUnitSuggestion', () => {
    it('suggests currency converter for currency category', () => {
      expect(
        resolveUnitSuggestion({
          hasResult: true,
          hasError: false,
          category: 'currency',
          inputUnitId: 'usd',
          outputUnitId: 'eur',
          inputValue: 100
        })?.id
      ).toBe('uc-currency');
    });

    it('suggests validation help on errors', () => {
      expect(
        resolveUnitSuggestion({
          hasResult: false,
          hasError: true,
          category: 'length',
          inputUnitId: 'meter',
          outputUnitId: 'foot',
          inputValue: 1
        })?.id
      ).toBe('uc-validation');
    });

    it('suggests help when units match', () => {
      expect(
        resolveUnitSuggestion({
          hasResult: true,
          hasError: false,
          category: 'length',
          inputUnitId: 'meter',
          outputUnitId: 'meter',
          inputValue: 1
        })?.id
      ).toBe('uc-same-unit');
    });
  });
});
