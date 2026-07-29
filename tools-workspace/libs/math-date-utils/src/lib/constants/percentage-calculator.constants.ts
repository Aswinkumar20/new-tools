import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  AdvancedOption,
  ModeDefinition,
  PercentageCalculatorFormValues,
  PresetDefinition
} from '../types/percentage-calculator.types';

export const PERCENTAGE_HISTORY_LIMIT = 10;

/** Percent values at or above this often warrant a second look (markup / error). */
export const PERCENTAGE_HIGH_THRESHOLD = 100;

export const PERCENTAGE_DEFAULT_FORM: PercentageCalculatorFormValues = {
  mode: 'percentageOf',
  baseValue: '120',
  percentageValue: '20',
  resultValue: '24',
  increaseDecreaseValue: '15',
  decimalPlaces: 2,
  showSteps: true,
  roundResult: false,
  includeDifference: true
};

export const PERCENTAGE_MODES: ReadonlyArray<ModeDefinition> = [
  {
    id: 'percentageOf',
    label: 'Find percentage of a value',
    description: 'e.g. 20% of 80',
    icon: '🎯',
    requiredFields: ['baseValue', 'percentageValue']
  },
  {
    id: 'isWhatPercent',
    label: 'What percent of',
    description: 'e.g. 30 is what percent of 120',
    icon: '📊',
    requiredFields: ['baseValue', 'resultValue']
  },
  {
    id: 'percentageChange',
    label: 'Percentage change',
    description: 'Find increase/decrease from original',
    icon: '📈',
    requiredFields: ['baseValue', 'resultValue']
  },
  {
    id: 'percentageIncrease',
    label: 'Percentage increase',
    description: 'Add percentage to base value',
    icon: '➕',
    requiredFields: ['baseValue', 'percentageValue']
  },
  {
    id: 'percentageDecrease',
    label: 'Percentage decrease',
    description: 'Subtract percentage from base value',
    icon: '➖',
    requiredFields: ['baseValue', 'percentageValue']
  }
];

export const PERCENTAGE_PRESETS: ReadonlyArray<PresetDefinition> = [
  { label: 'Sales tax (8.25%)', mode: 'percentageOf', baseValue: '89.99', percentageValue: '8.25' },
  { label: 'Discount (25%)', mode: 'percentageDecrease', baseValue: '120', percentageValue: '25' },
  { label: 'Tip (18%)', mode: 'percentageOf', baseValue: '56.40', percentageValue: '18' },
  {
    label: 'Progress completion',
    mode: 'isWhatPercent',
    baseValue: '200',
    resultValue: '65',
    percentageValue: '0'
  },
  { label: 'Salary raise', mode: 'percentageIncrease', baseValue: '65000', percentageValue: '12' }
];

export const PERCENTAGE_ADVANCED_OPTIONS: ReadonlyArray<AdvancedOption> = [
  {
    id: 'roundResult',
    label: 'Round result',
    description: 'Round to nearest integer after applying decimal precision.'
  },
  {
    id: 'includeDifference',
    label: 'Show difference',
    description: 'Show absolute change in addition to the percentage value.'
  },
  {
    id: 'showSteps',
    label: 'Display steps',
    description: 'Show formula steps for the calculation.'
  }
];

export const PERCENTAGE_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Tip Calculator',
    path: '/math-date-utils/tip-calculator',
    description: 'Split bills and tip amounts with party size'
  },
  {
    label: 'Fraction Calculator',
    path: '/math-date-utils/fraction-calculator',
    description: 'Express ratios as fractions alongside percentages'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out percentage results for documents'
  },
  {
    label: 'Loan EMI Calculator',
    path: '/math-date-utils/loan-emi-calculator',
    description: 'Apply rate percentages to loan amortization'
  }
];
