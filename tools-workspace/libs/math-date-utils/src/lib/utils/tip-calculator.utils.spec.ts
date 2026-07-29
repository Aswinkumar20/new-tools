import {
  calculateTip,
  formatTipCurrency,
  resolveTipSuggestion,
  toNumber
} from './tip-calculator.utils';

describe('tip-calculator.utils', () => {
  describe('toNumber', () => {
    it('parses comma-separated amounts', () => {
      expect(toNumber('1,250.5')).toBe(1250.5);
      expect(toNumber('')).toBe(0);
      expect(toNumber(42)).toBe(42);
    });
  });

  describe('calculateTip', () => {
    const base = {
      amount: 100,
      tipPercent: 20,
      taxPercent: 10,
      splitMode: 'equal' as const,
      splitCount: 2,
      round: false,
      customShares: [] as number[],
      currency: 'USD'
    };

    it('computes tip, tax, and equal split', () => {
      const result = calculateTip(base);
      expect(result.summary.totalTip).toBe(20);
      expect(result.summary.totalTax).toBe(10);
      expect(result.summary.grandTotal).toBe(130);
      expect(result.summary.perPerson).toEqual([65, 65]);
      expect(result.tips.length).toBeGreaterThan(0);
    });

    it('distributes custom shares', () => {
      const result = calculateTip({
        ...base,
        splitMode: 'custom',
        customShares: [1, 3],
        taxPercent: 0,
        tipPercent: 0
      });
      expect(result.summary.perPerson[0]).toBeCloseTo(25);
      expect(result.summary.perPerson[1]).toBeCloseTo(75);
      expect(result.summary.perPersonLabels[0]).toBe('Guest 1');
    });

    it('applies rounding adjustment', () => {
      const result = calculateTip({
        ...base,
        amount: 10.01,
        tipPercent: 15,
        taxPercent: 0,
        splitCount: 1,
        round: true
      });
      expect(result.summary.grandTotal).toBe(Math.round(result.summary.grandTotal * 100) / 100);
    });
  });

  describe('formatTipCurrency', () => {
    it('formats with the selected currency', () => {
      expect(formatTipCurrency(12.5, 'USD')).toContain('12.50');
    });
  });

  describe('resolveTipSuggestion', () => {
    it('suggests validation help on errors', () => {
      expect(
        resolveTipSuggestion({
          hasResult: false,
          hasError: true,
          tipPercent: 18,
          taxPercent: 0,
          splitCount: 2,
          splitMode: 'equal',
          amount: -1,
          currency: 'USD'
        })?.id
      ).toBe('tc-validation');
    });

    it('suggests fraction tool for custom shares', () => {
      expect(
        resolveTipSuggestion({
          hasResult: true,
          hasError: false,
          tipPercent: 18,
          taxPercent: 0,
          splitCount: 4,
          splitMode: 'custom',
          amount: 100,
          currency: 'USD'
        })?.id
      ).toBe('tc-custom');
    });

    it('suggests percentage help when tax is present', () => {
      expect(
        resolveTipSuggestion({
          hasResult: true,
          hasError: false,
          tipPercent: 18,
          taxPercent: 8.5,
          splitCount: 2,
          splitMode: 'equal',
          amount: 86.4,
          currency: 'USD'
        })?.id
      ).toBe('tc-tax');
    });
  });
});
