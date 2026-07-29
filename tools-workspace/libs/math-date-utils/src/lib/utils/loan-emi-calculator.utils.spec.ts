import {
  LOAN_EMI_PAYMENT_FREQUENCIES
} from '../constants/loan-emi-calculator.constants';
import {
  calculateLoanEmi,
  computeEmi,
  computeExtraPerPeriod,
  formatLoanCurrency,
  formatLoanSummaryText,
  resolveLoanEmiSuggestion,
  toNumber
} from './loan-emi-calculator.utils';
import type { LoanInput } from '../types/loan-emi-calculator.types';

function baseInput(overrides: Partial<LoanInput> = {}): LoanInput {
  return {
    amount: 100000,
    rate: 0.1,
    termMonths: 12,
    frequency: LOAN_EMI_PAYMENT_FREQUENCIES[0],
    loanType: 'reducing',
    extraPayment: 0,
    extraMode: 'none',
    ...overrides
  };
}

describe('loan-emi-calculator.utils', () => {
  describe('toNumber', () => {
    it('parses comma-separated amounts', () => {
      expect(toNumber('1,250.5')).toBe(1250.5);
      expect(toNumber('')).toBe(0);
      expect(toNumber(42)).toBe(42);
    });
  });

  describe('computeEmi', () => {
    it('returns principal divided by periods when rate is zero', () => {
      expect(computeEmi(1200, 0, 12)).toBe(100);
    });

    it('computes a positive EMI for a standard loan', () => {
      const emi = computeEmi(100000, 0.1 / 12, 12);
      expect(emi).toBeGreaterThan(8000);
      expect(emi).toBeLessThan(10000);
    });
  });

  describe('computeExtraPerPeriod', () => {
    it('scales monthly extras for bi-weekly frequency', () => {
      const biweekly = LOAN_EMI_PAYMENT_FREQUENCIES[1];
      expect(computeExtraPerPeriod(100, 'monthly', biweekly)).toBeCloseTo(100 * (12 / 26));
    });

    it('returns zero when mode is none', () => {
      expect(computeExtraPerPeriod(100, 'none', LOAN_EMI_PAYMENT_FREQUENCIES[0])).toBe(0);
    });
  });

  describe('calculateLoanEmi', () => {
    it('calculates a reducing-balance loan', () => {
      const result = calculateLoanEmi(baseInput());
      expect(result.summary.emi).toBeGreaterThan(0);
      expect(result.summary.totalPayments).toBeGreaterThan(result.summary.emi);
      expect(result.schedulePreview.length).toBeGreaterThan(0);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('calculates a flat-rate loan with constant schedule portions', () => {
      const result = calculateLoanEmi(baseInput({ loanType: 'flat', amount: 12000, rate: 0.12 }));
      expect(result.summary.totalInterest).toBeCloseTo(1440);
      expect(result.schedulePreview[0].extraPayment).toBe(0);
      expect(result.insights.some((tip) => tip.includes('Flat rate'))).toBe(true);
    });

    it('rejects non-positive amounts', () => {
      expect(() => calculateLoanEmi(baseInput({ amount: 0 }))).toThrow(
        'Loan amount must be greater than zero.'
      );
    });
  });

  describe('formatting', () => {
    it('formats currency and summary text', () => {
      expect(formatLoanCurrency(12.5)).toContain('12.50');
      const text = formatLoanSummaryText({
        emi: 100,
        totalPayments: 1200,
        totalInterest: 200,
        durationMonths: 12
      });
      expect(text).toContain('EMI:');
      expect(text).toContain('Duration: 12 months');
    });
  });

  describe('resolveLoanEmiSuggestion', () => {
    it('suggests validation help on errors', () => {
      expect(
        resolveLoanEmiSuggestion({
          hasResult: false,
          hasError: true,
          loanType: 'reducing',
          ratePercent: 5,
          termMonths: 12,
          amount: 1000,
          frequency: 'monthly',
          hasExtraPayments: false,
          hasInterestSavings: false
        })?.id
      ).toBe('lec-validation');
    });

    it('suggests interest comparison for flat loans', () => {
      expect(
        resolveLoanEmiSuggestion({
          hasResult: true,
          hasError: false,
          loanType: 'flat',
          ratePercent: 5,
          termMonths: 36,
          amount: 15000,
          frequency: 'monthly',
          hasExtraPayments: false,
          hasInterestSavings: false
        })?.id
      ).toBe('lec-flat');
    });

    it('suggests help for high rates', () => {
      expect(
        resolveLoanEmiSuggestion({
          hasResult: true,
          hasError: false,
          loanType: 'reducing',
          ratePercent: 11.5,
          termMonths: 36,
          amount: 15000,
          frequency: 'monthly',
          hasExtraPayments: false,
          hasInterestSavings: false
        })?.id
      ).toBe('lec-high-rate');
    });
  });
});
