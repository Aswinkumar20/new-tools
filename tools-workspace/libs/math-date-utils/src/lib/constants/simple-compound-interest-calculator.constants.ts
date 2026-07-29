import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  ContributionFrequencyDefinition,
  FrequencyDefinition,
  InterestCalculatorFormValues,
  InterestModeDefinition,
  InterestPreset
} from '../types/simple-compound-interest-calculator.types';

export const INTEREST_HISTORY_LIMIT = 8;

/** Annual rate (%) at or above this often warrants comparing loan/EMI costs. */
export const INTEREST_HIGH_RATE_PERCENT = 10;

/** Tenure (years) at or above this suggests long-horizon planning tools. */
export const INTEREST_LONG_HORIZON_YEARS = 15;

export const INTEREST_DEFAULT_FORM: InterestCalculatorFormValues = {
  mode: 'compound',
  principal: '10000',
  rate: '7.5',
  time: '5',
  frequency: 'annually',
  contributions: '0',
  contributionFrequency: 'monthly',
  targetAmount: '',
  includeTimeline: true,
  includeBreakdown: true
};

export const INTEREST_MODES: ReadonlyArray<InterestModeDefinition> = [
  {
    id: 'compound',
    label: 'Compound growth',
    description: 'Earnings reinvested at each compounding period.',
    icon: '📈'
  },
  {
    id: 'simple',
    label: 'Simple interest',
    description: 'Interest applied to the original principal only.',
    icon: '🧮'
  }
];

export const INTEREST_COMPOUND_FREQUENCIES: ReadonlyArray<FrequencyDefinition> = [
  { id: 'annually', label: 'Annually (1×)', periodsPerYear: 1 },
  { id: 'semiannually', label: 'Semi-annually (2×)', periodsPerYear: 2 },
  { id: 'quarterly', label: 'Quarterly (4×)', periodsPerYear: 4 },
  { id: 'monthly', label: 'Monthly (12×)', periodsPerYear: 12 },
  { id: 'weekly', label: 'Weekly (52×)', periodsPerYear: 52 },
  { id: 'daily', label: 'Daily (365×)', periodsPerYear: 365 }
];

export const INTEREST_CONTRIBUTION_FREQUENCIES: ReadonlyArray<ContributionFrequencyDefinition> = [
  { id: 'annually', label: 'Annually', periodsPerYear: 1 },
  { id: 'semiannually', label: 'Semi-annually', periodsPerYear: 2 },
  { id: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
  { id: 'monthly', label: 'Monthly', periodsPerYear: 12 },
  { id: 'biweekly', label: 'Bi-weekly', periodsPerYear: 26 },
  { id: 'weekly', label: 'Weekly', periodsPerYear: 52 }
];

export const INTEREST_PRESETS: ReadonlyArray<InterestPreset> = [
  {
    label: 'Retirement (compound)',
    mode: 'compound',
    principal: '25000',
    rate: '6.5',
    time: '25',
    frequency: 'monthly',
    contributions: '500',
    contributionFrequency: 'monthly',
    targetAmount: '500000'
  },
  {
    label: 'Certificate of deposit',
    mode: 'compound',
    principal: '15000',
    rate: '4.1',
    time: '3',
    frequency: 'quarterly'
  },
  {
    label: 'Loan (simple)',
    mode: 'simple',
    principal: '12000',
    rate: '5.9',
    time: '2',
    contributions: '0'
  },
  {
    label: 'College savings',
    mode: 'compound',
    principal: '8000',
    rate: '7',
    time: '18',
    frequency: 'monthly',
    contributions: '200',
    contributionFrequency: 'monthly',
    targetAmount: '100000'
  },
  {
    label: 'Short-term simple',
    mode: 'simple',
    principal: '5000',
    rate: '4',
    time: '1.5'
  }
];

export const INTEREST_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Loan EMI Calculator',
    path: '/math-date-utils/loan-emi-calculator',
    description: 'Turn rates into monthly payments and amortization'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Work out rate changes and growth percentages'
  },
  {
    label: 'Currency Converter',
    path: '/math-date-utils/currency-converter',
    description: 'Convert principal or future value across currencies'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out future-value totals for documents'
  }
];
