import {
  buildConversionInsights,
  buildCurrencyMap,
  buildTopMovers,
  calculateCurrencyConversion,
  createWatchlistEntry,
  formatConversionResultText,
  formatRateTimestamp,
  mapFallbackRateResponse,
  mergeCurrencyCodes,
  resolveCurrencySuggestion,
  sortCurrencyCatalog,
  toNumber,
  updateWatchlistEntries
} from './currency-converter.utils';
import type { ConversionResult, RateSnapshot } from '../types/currency-converter.types';

const SNAPSHOT: RateSnapshot = {
  base: 'USD',
  timestamp: 1_700_000_000_000,
  provider: 'test',
  rates: { EUR: 0.9, GBP: 0.8, JPY: 150 }
};

describe('currency-converter.utils', () => {
  describe('calculateCurrencyConversion', () => {
    it('converts with optional fees', () => {
      const result = calculateCurrencyConversion({
        snapshot: SNAPSHOT,
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        includeFees: true,
        feePercent: 0.05
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.feeAmount).toBe(5);
        expect(result.amountAfterFee).toBe(95);
        expect(result.convertedAmount).toBeCloseTo(85.5, 5);
        expect(result.inverseRate).toBeCloseTo(1 / 0.9, 5);
      }
    });

    it('uses identity rate for same currency', () => {
      const result = calculateCurrencyConversion({
        snapshot: SNAPSHOT,
        amount: 50,
        fromCurrency: 'USD',
        toCurrency: 'USD',
        includeFees: false,
        feePercent: 0
      });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.rate).toBe(1);
        expect(result.convertedAmount).toBe(50);
      }
    });

    it('returns an error when the quote rate is missing', () => {
      const result = calculateCurrencyConversion({
        snapshot: SNAPSHOT,
        amount: 10,
        fromCurrency: 'USD',
        toCurrency: 'ZZZ',
        includeFees: false,
        feePercent: 0
      });
      expect(result).toEqual({
        error: 'No exchange rate available for USD → ZZZ.'
      });
    });
  });

  describe('movers and watchlist', () => {
    it('builds initial movers and ranked movers', () => {
      const map = buildCurrencyMap([{ code: 'EUR', name: 'Euro' }]);
      const initial = buildTopMovers(SNAPSHOT, map);
      expect(initial.length).toBeGreaterThan(0);
      expect(initial[0].changePercent).toBe(0);

      const previous: RateSnapshot = {
        ...SNAPSHOT,
        rates: { EUR: 1, GBP: 0.8, JPY: 100 }
      };
      const ranked = buildTopMovers(SNAPSHOT, map, previous, 2);
      expect(ranked.length).toBeLessThanOrEqual(2);
      expect(Math.abs(ranked[0].changePercent)).toBeGreaterThanOrEqual(
        Math.abs(ranked[1]?.changePercent ?? 0)
      );
    });

    it('updates watchlist rates and merges unknown codes', () => {
      const map = buildCurrencyMap([{ code: 'EUR', name: 'Euro' }]);
      const entry = createWatchlistEntry('EUR', map);
      const updated = updateWatchlistEntries([entry], SNAPSHOT, map);
      expect(updated[0].rate).toBe(0.9);

      expect(mergeCurrencyCodes(map, ['XYZ'])).toBe(true);
      expect(sortCurrencyCatalog(map).some((item) => item.code === 'XYZ')).toBe(true);
    });
  });

  describe('formatting and parsing', () => {
    it('formats insights, copy text, and timestamps', () => {
      const result: ConversionResult = {
        baseCurrency: 'USD',
        quoteCurrency: 'EUR',
        rate: 0.9,
        inverseRate: 1 / 0.9,
        convertedAmount: 90,
        feeAmount: 0,
        amountAfterFee: 100,
        timestamp: SNAPSHOT.timestamp,
        provider: 'test'
      };
      const insights = buildConversionInsights(result, 0.8);
      expect(insights.some((item) => item.includes('Rate changed'))).toBe(true);
      expect(formatConversionResultText(result, 100)).toContain('USD = 90.00 EUR');
      expect(formatRateTimestamp(null)).toBe('—');
      expect(formatRateTimestamp(SNAPSHOT.timestamp)).not.toBe('—');
      expect(toNumber('1,250.5')).toBe(1250.5);
    });

    it('maps fallback responses', () => {
      expect(
        mapFallbackRateResponse({
          base: 'USD',
          rates: { EUR: 0.9 },
          date: '2024-01-01'
        }).provider
      ).toBe('exchangerate.host');
      expect(() =>
        mapFallbackRateResponse({ base: '', rates: {}, date: '' })
      ).toThrow('Unable to fetch currency rates.');
    });
  });

  describe('resolveCurrencySuggestion', () => {
    it('prioritizes errors and same-currency pairs', () => {
      expect(
        resolveCurrencySuggestion({
          hasResult: false,
          hasError: true,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          includeFees: false,
          amount: 100,
          convertedAmount: 0
        })?.id
      ).toBe('cc-rate-error');

      expect(
        resolveCurrencySuggestion({
          hasResult: true,
          hasError: false,
          fromCurrency: 'USD',
          toCurrency: 'USD',
          includeFees: false,
          amount: 100,
          convertedAmount: 100
        })?.id
      ).toBe('cc-same-currency');
    });

    it('suggests number-to-words for large conversions', () => {
      expect(
        resolveCurrencySuggestion({
          hasResult: true,
          hasError: false,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          includeFees: false,
          amount: 2000,
          convertedAmount: 1800
        })?.id
      ).toBe('cc-large-amount');
    });
  });
});
