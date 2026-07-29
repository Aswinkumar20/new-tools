import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  CaseStyleOption,
  CurrencyDefinition,
  FormatOption,
  LocaleDefinition,
  NumberToWordsFormValues,
  SampleNumber
} from '../types/number-to-words.types';

export const NUMBER_TO_WORDS_HISTORY_LIMIT = 12;

/** Absolute magnitude at or above this suggests scientific / large-number context. */
export const NUMBER_TO_WORDS_LARGE_NUMBER = 1_000_000_000;

export const NUMBER_TO_WORDS_INPUT_PATTERN = /^-?\d+(\.\d{0,6})?$/;

export const NUMBER_TO_WORDS_DEFAULT_FORM: NumberToWordsFormValues = {
  numericInput: '123456.78',
  locale: 'en-US',
  format: 'cardinal',
  currency: 'USD',
  showCurrencySymbol: true,
  includeCents: true,
  caseStyle: 'sentence',
  includeAnd: true,
  handleNegative: true
};

export const NUMBER_TO_WORDS_FORMAT_OPTIONS: ReadonlyArray<FormatOption> = [
  {
    id: 'cardinal',
    label: 'Cardinal',
    description: 'Standard words, e.g. "one hundred twenty-three"',
    icon: 'words'
  },
  {
    id: 'ordinal',
    label: 'Ordinal',
    description: 'Positions, e.g. "one hundred twenty-third"',
    icon: 'list'
  },
  {
    id: 'currency',
    label: 'Currency',
    description: 'Money format, e.g. "one hundred dollars"',
    icon: 'currency'
  }
];

export const NUMBER_TO_WORDS_CASE_STYLES: ReadonlyArray<CaseStyleOption> = [
  { id: 'sentence', label: 'Sentence case', description: 'Capitalise first word only.' },
  { id: 'title', label: 'Title Case', description: 'Capitalise principal words.' },
  { id: 'upper', label: 'UPPERCASE', description: 'All letters upper case.' },
  { id: 'lower', label: 'lowercase', description: 'All letters lower case.' }
];

export const NUMBER_TO_WORDS_LOCALES: ReadonlyArray<LocaleDefinition> = [
  {
    id: 'en-US',
    label: 'English (United States)',
    sample: '1,234,567.89',
    groupSeparator: ',',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'],
      primaryGroupSize: 3,
      secondaryGroupSize: 3
    },
    ordinalSupport: true
  },
  {
    id: 'en-UK',
    label: 'English (United Kingdom)',
    sample: '1 234 567.89',
    groupSeparator: ' ',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'],
      primaryGroupSize: 3,
      secondaryGroupSize: 3
    },
    ordinalSupport: true
  },
  {
    id: 'en-IN',
    label: 'English (India)',
    sample: '1,23,45,678.90',
    groupSeparator: ',',
    decimalSeparator: '.',
    scale: {
      thousands: ['', 'thousand', 'lakh', 'crore', 'arab', 'kharab'],
      primaryGroupSize: 3,
      secondaryGroupSize: 2
    },
    ordinalSupport: true
  }
];

export const NUMBER_TO_WORDS_CURRENCIES: ReadonlyArray<CurrencyDefinition> = [
  {
    code: 'USD',
    label: 'US Dollar',
    majorSingular: 'dollar',
    majorPlural: 'dollars',
    minorSingular: 'cent',
    minorPlural: 'cents',
    symbol: '$',
    supportedLocales: ['en-US', 'en-UK']
  },
  {
    code: 'EUR',
    label: 'Euro',
    majorSingular: 'euro',
    majorPlural: 'euros',
    minorSingular: 'cent',
    minorPlural: 'cents',
    symbol: '€',
    supportedLocales: ['en-US', 'en-UK']
  },
  {
    code: 'GBP',
    label: 'Pound Sterling',
    majorSingular: 'pound',
    majorPlural: 'pounds',
    minorSingular: 'penny',
    minorPlural: 'pence',
    symbol: '£',
    supportedLocales: ['en-UK']
  },
  {
    code: 'INR',
    label: 'Indian Rupee',
    majorSingular: 'rupee',
    majorPlural: 'rupees',
    minorSingular: 'paise',
    minorPlural: 'paise',
    symbol: '₹',
    supportedLocales: ['en-IN']
  }
];

export const NUMBER_TO_WORDS_SAMPLES: ReadonlyArray<SampleNumber> = [
  { label: 'Invoice total', value: '482356.71', format: 'currency', locale: 'en-US', currency: 'USD' },
  { label: 'Lottery prize', value: '305000000', format: 'cardinal', locale: 'en-US' },
  { label: 'Indian budget', value: '98765432', format: 'currency', locale: 'en-IN', currency: 'INR' },
  { label: 'Rank position', value: '112', format: 'ordinal', locale: 'en-UK' },
  { label: 'Negative balance', value: '-4520.5', format: 'currency', locale: 'en-US', currency: 'USD' },
  { label: 'Scientific', value: '1200000000000', format: 'cardinal', locale: 'en-US' }
];

export const NUMBER_TO_WORDS_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Currency Converter',
    path: '/math-date-utils/currency-converter',
    description: 'Convert amounts before spelling them out in words'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Turn decimals into percents for reports and invoices'
  },
  {
    label: 'Loan EMI Calculator',
    path: '/math-date-utils/loan-emi-calculator',
    description: 'Spell out EMI totals for contracts and cheque text'
  },
  {
    label: 'Fraction Calculator',
    path: '/math-date-utils/fraction-calculator',
    description: 'Simplify ratios before expressing whole-number results'
  }
];
