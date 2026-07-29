import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type { TipCalculatorFormValues, TipPreset } from '../types/tip-calculator.types';

export const TIP_HISTORY_LIMIT = 8;

/** Tip % at or above this often signals premium service. */
export const TIP_HIGH_PERCENT = 20;

/** Party size at or above this benefits from custom split planning. */
export const TIP_LARGE_PARTY_COUNT = 6;

export const TIP_DEFAULT_CUSTOM_SHARES: ReadonlyArray<number> = [1, 1, 1, 1];

export const TIP_CURRENCIES: ReadonlyArray<string> = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export const TIP_DEFAULT_FORM: TipCalculatorFormValues = {
  amount: '86.40',
  tipPercent: '18',
  taxPercent: '8.5',
  splitMode: 'equal',
  splitCount: '2',
  customShares: TIP_DEFAULT_CUSTOM_SHARES.map((share) => share.toString()),
  round: true,
  currency: 'USD',
  includeHistory: true
};

export const TIP_PRESETS: ReadonlyArray<TipPreset> = [
  { label: 'Coffee break', amount: '18.50', tipPercent: '15', splitCount: '1' },
  { label: 'Casual dinner', amount: '86.40', tipPercent: '18', taxPercent: '8.5', splitCount: '2' },
  { label: 'Gourmet night', amount: '245.00', tipPercent: '20', taxPercent: '10', splitCount: '4' },
  { label: 'Large party', amount: '620.00', tipPercent: '18', taxPercent: '9', splitCount: '8' },
  { label: 'Takeout', amount: '42.00', tipPercent: '12', taxPercent: '0', splitCount: '1' }
];

export const TIP_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Double-check tip or tax percentages against the bill'
  },
  {
    label: 'Currency Converter',
    path: '/math-date-utils/currency-converter',
    description: 'Convert the bill before tipping in another currency'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out totals for expense reports or receipts'
  },
  {
    label: 'Fraction Calculator',
    path: '/math-date-utils/fraction-calculator',
    description: 'Express custom share ratios in lowest terms'
  }
];
