import {
  computeRandomNumberStats,
  formatRandomNumber,
  generateRandomDecimal,
  generateRandomInteger,
  generateRandomNumbers,
  looksLikeDiceRange,
  prependGeneratedHistory,
  resolveRandomNumberSuggestion,
  validateRandomNumberOptions
} from './random-number-generator.utils';

describe('random-number-generator.utils', () => {
  describe('validation', () => {
    it('enforces legacy messages', () => {
      expect(
        validateRandomNumberOptions({
          min: 10,
          max: 5,
          count: 1,
          integerOnly: true,
          decimals: 2
        })
      ).toBe('Minimum value must be less than maximum value.');
      expect(
        validateRandomNumberOptions({
          min: 1,
          max: 10,
          count: 0,
          integerOnly: true,
          decimals: 2
        })
      ).toBe('Count must be between 1 and 1000.');
      expect(
        validateRandomNumberOptions({
          min: 1,
          max: 10,
          count: 1,
          integerOnly: false,
          decimals: 11
        })
      ).toBe('Decimal places must be between 0 and 10.');
    });
  });

  describe('generation', () => {
    it('produces integers and decimals with injectable random', () => {
      expect(generateRandomInteger(1, 6, () => 0)).toBe(1);
      expect(generateRandomInteger(1, 6, () => 0.999)).toBe(6);
      expect(generateRandomDecimal(0, 1, 2, () => 0.5)).toBe(0.5);

      const batch = generateRandomNumbers(
        { min: 1, max: 1, count: 3, integerOnly: true, decimals: 0 },
        () => 0,
        () => 100
      );
      expect(batch.map((n) => n.value)).toEqual([1, 1, 1]);
      expect(batch.map((n) => n.timestamp)).toEqual([100, 101, 102]);
    });

    it('prepends and caps history', () => {
      expect(
        prependGeneratedHistory(
          [{ value: 2, timestamp: 2 }],
          [{ value: 1, timestamp: 1 }],
          2
        )
      ).toEqual([
        { value: 1, timestamp: 1 },
        { value: 2, timestamp: 2 }
      ]);
    });
  });

  describe('stats and format', () => {
    it('computes stats and formats values', () => {
      expect(computeRandomNumberStats([])).toEqual({
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        sum: 0
      });
      expect(
        computeRandomNumberStats([
          { value: 2, timestamp: 1 },
          { value: 4, timestamp: 2 }
        ])
      ).toEqual({ count: 2, min: 2, max: 4, average: 3, sum: 6 });
      expect(formatRandomNumber(1.5, true, 2)).toBe('1.5');
      expect(formatRandomNumber(1.5, false, 2)).toBe('1.50');
    });
  });

  describe('suggestions', () => {
    it('detects dice ranges and security batches', () => {
      expect(looksLikeDiceRange(1, 6, true)).toBe(true);
      expect(
        resolveRandomNumberSuggestion({
          hasResults: false,
          hasError: false,
          min: 1,
          max: 6,
          count: 1,
          integerOnly: true
        })?.id
      ).toBe('rng-dice');
      expect(
        resolveRandomNumberSuggestion({
          hasResults: true,
          hasError: false,
          min: 1,
          max: 100,
          count: 20,
          integerOnly: true
        })?.id
      ).toBe('rng-security');
    });
  });
});
