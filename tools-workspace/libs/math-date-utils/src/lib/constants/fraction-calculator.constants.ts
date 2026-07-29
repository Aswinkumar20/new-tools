import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  FractionCalculatorFormValues,
  FractionOperationMeta,
  FractionPreset
} from '../types/fraction-calculator.types';

export const FRACTION_INTEGER_PATTERN = /^-?\d+$/;

export const FRACTION_DEFAULT_PRECISION = 4;

export const FRACTION_DEFAULT_FORM: FractionCalculatorFormValues = {
  fractionA: { numerator: '3', denominator: '4' },
  fractionB: { numerator: '2', denominator: '5' },
  operation: 'add',
  autoSimplify: true,
  showSteps: true,
  precision: FRACTION_DEFAULT_PRECISION
};

export const FRACTION_OPERATIONS: ReadonlyArray<FractionOperationMeta> = [
  {
    id: 'add',
    label: 'Addition',
    symbol: '+',
    helper: 'Find a common denominator and add numerators.'
  },
  {
    id: 'subtract',
    label: 'Subtraction',
    symbol: '−',
    helper: 'Align denominators then subtract numerators.'
  },
  {
    id: 'multiply',
    label: 'Multiplication',
    symbol: '×',
    helper: 'Multiply across numerators and denominators.'
  },
  {
    id: 'divide',
    label: 'Division',
    symbol: '÷',
    helper: 'Multiply by the reciprocal of the second fraction.'
  }
];

export const FRACTION_PRESETS: ReadonlyArray<FractionPreset> = [
  {
    id: 'common-denominators',
    label: 'Common denominators',
    operation: 'add',
    left: { numerator: '3', denominator: '8' },
    right: { numerator: '5', denominator: '8' },
    description: 'Evaluate addition when denominators already match.'
  },
  {
    id: 'mixed-result',
    label: 'Mixed number output',
    operation: 'add',
    left: { numerator: '11', denominator: '6' },
    right: { numerator: '7', denominator: '4' },
    description: 'Produces an improper fraction that simplifies to a mixed number.'
  },
  {
    id: 'negative-values',
    label: 'Negative operands',
    operation: 'subtract',
    left: { numerator: '-5', denominator: '9' },
    right: { numerator: '2', denominator: '3' },
    description: 'Illustrates subtraction across negative and positive values.'
  },
  {
    id: 'division-sample',
    label: 'Division sample',
    operation: 'divide',
    left: { numerator: '7', denominator: '10' },
    right: { numerator: '1', denominator: '5' },
    description: 'Shows division as multiplication by the reciprocal.'
  }
];

export const FRACTION_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Convert decimal results into percentages'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out decimal or whole-number answers'
  },
  {
    label: 'Unit Converter',
    path: '/math-date-utils/unit-converter',
    description: 'Apply fractional ratios to real-world units'
  },
  {
    label: 'Tip Calculator',
    path: '/math-date-utils/tip-calculator',
    description: 'Split bills using fractional shares'
  }
];
