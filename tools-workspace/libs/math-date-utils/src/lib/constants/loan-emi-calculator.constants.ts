import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  LoanEmiFormValues,
  LoanPreset,
  PaymentFrequency
} from '../types/loan-emi-calculator.types';

export const LOAN_EMI_HISTORY_LIMIT = 8;
export const LOAN_EMI_MAX_SCHEDULE_PREVIEW = 24;
export const LOAN_EMI_MIN_AMOUNT = 1000;

/** Annual rate (%) at or above this suggests comparing interest strategies. */
export const LOAN_EMI_HIGH_RATE_PERCENT = 10;

/** Tenure (months) at or above this often benefits from bi-weekly comparisons. */
export const LOAN_EMI_LONG_TERM_MONTHS = 240;

export const LOAN_EMI_PAYMENT_FREQUENCIES: ReadonlyArray<PaymentFrequency> = [
  { id: 'monthly', label: 'Monthly (12×)', periodsPerYear: 12 },
  { id: 'biweekly', label: 'Bi-weekly (26×)', periodsPerYear: 26 },
  { id: 'weekly', label: 'Weekly (52×)', periodsPerYear: 52 }
];

export const LOAN_EMI_DEFAULT_FORM: LoanEmiFormValues = {
  amount: '350000',
  rate: '5.1',
  termYears: '30',
  termMonths: '0',
  frequency: 'monthly',
  loanType: 'reducing',
  startDate: '',
  extraPayment: '0',
  extraMode: 'none',
  includeHistory: true
};

export const LOAN_EMI_PRESETS: ReadonlyArray<LoanPreset> = [
  {
    label: 'Starter home',
    amount: '350000',
    rate: '5.1',
    termYears: '30',
    startDate: new Date().toISOString().slice(0, 10)
  },
  {
    label: 'Car loan',
    amount: '35000',
    rate: '6.5',
    termYears: '5',
    frequency: 'monthly',
    loanType: 'reducing'
  },
  {
    label: 'Education',
    amount: '52000',
    rate: '4.2',
    termYears: '10',
    frequency: 'monthly',
    loanType: 'reducing'
  },
  {
    label: 'Personal loan',
    amount: '15000',
    rate: '11.5',
    termYears: '3',
    frequency: 'monthly',
    loanType: 'flat'
  },
  {
    label: 'Aggressive mortgage',
    amount: '420000',
    rate: '5.3',
    termYears: '25',
    frequency: 'biweekly',
    loanType: 'reducing'
  }
];

export const LOAN_EMI_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Simple & Compound Interest',
    path: '/math-date-utils/simple-compound-interest-calculator',
    description: 'Compare interest growth without amortization schedules'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Work out down-payment or interest share percentages'
  },
  {
    label: 'Currency Converter',
    path: '/math-date-utils/currency-converter',
    description: 'Convert EMI totals when dealing with foreign currency loans'
  },
  {
    label: 'Tip Calculator',
    path: '/math-date-utils/tip-calculator',
    description: 'Quick splits when budgeting monthly cash flow'
  }
];
