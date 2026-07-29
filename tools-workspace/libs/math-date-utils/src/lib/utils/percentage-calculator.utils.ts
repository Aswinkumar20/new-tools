import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  PERCENTAGE_HIGH_THRESHOLD,
  PERCENTAGE_MODES
} from '../constants/percentage-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  CalculationResult,
  CalculatorMode,
  ModeDefinition,
  PercentageCalculatorOptions,
  PercentageSuggestionContext
} from '../types/percentage-calculator.types';

export function numberValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? null : { number: true };
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalised = value.split(',').join('').trim();
    return normalised ? Number(normalised) : 0;
  }

  return 0;
}

export function formatPercentageNumber(
  value: number,
  digits: number,
  shouldRound: boolean
): string {
  const precisionValue = shouldRound ? Math.round(value) : Number(value.toFixed(digits));
  return precisionValue.toLocaleString(undefined, {
    minimumFractionDigits: shouldRound ? 0 : digits,
    maximumFractionDigits: shouldRound ? 0 : digits
  });
}

export function resolvePercentageMode(modeId: CalculatorMode | null | undefined): ModeDefinition {
  return PERCENTAGE_MODES.find((mode) => mode.id === (modeId ?? 'percentageOf')) ?? PERCENTAGE_MODES[0];
}

export function getPercentageModeLabel(mode: CalculatorMode): string {
  return resolvePercentageMode(mode).label;
}

export function mapPercentageCalculationError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to complete calculation.';
}

export function computePercentage(options: PercentageCalculatorOptions): CalculationResult {
  switch (options.mode) {
    case 'percentageOf':
      return calculatePercentageOf(options);
    case 'isWhatPercent':
      return calculateIsWhatPercent(options);
    case 'percentageChange':
      return calculatePercentageChange(options);
    case 'percentageIncrease':
      return calculatePercentageIncrease(options);
    case 'percentageDecrease':
      return calculatePercentageDecrease(options);
    default:
      throw new Error('Unsupported calculation mode.');
  }
}

function calculatePercentageOf(options: PercentageCalculatorOptions): CalculationResult {
  const value = (options.baseValue * options.percentageValue) / 100;
  const difference = options.includeDifference ? value : undefined;

  return {
    ...options,
    value,
    difference,
    steps: [
      `Input: ${options.percentageValue}% of ${options.baseValue}`,
      `Formula: (percentage ÷ 100) × base`,
      `Calculation: (${options.percentageValue} ÷ 100) × ${options.baseValue} = ${value}`
    ],
    timestamp: Date.now()
  };
}

function calculateIsWhatPercent(options: PercentageCalculatorOptions): CalculationResult {
  if (options.baseValue === 0) {
    throw new Error('Base value cannot be zero for this calculation.');
  }

  const value = (options.resultValue / options.baseValue) * 100;
  const difference = options.includeDifference
    ? options.resultValue - options.baseValue
    : undefined;

  return {
    ...options,
    value,
    difference,
    steps: [
      `Input: What percent is ${options.resultValue} of ${options.baseValue}?`,
      `Formula: (result ÷ base) × 100`,
      `Calculation: (${options.resultValue} ÷ ${options.baseValue}) × 100 = ${value}`
    ],
    timestamp: Date.now()
  };
}

function calculatePercentageChange(options: PercentageCalculatorOptions): CalculationResult {
  if (options.baseValue === 0) {
    throw new Error('Original value cannot be zero for percentage change.');
  }

  const difference = options.resultValue - options.baseValue;
  const value = (difference / options.baseValue) * 100;

  return {
    ...options,
    value,
    difference,
    steps: [
      `Input: Change from ${options.baseValue} to ${options.resultValue}`,
      `Formula: ((new - original) ÷ original) × 100`,
      `Calculation: ((${options.resultValue} - ${options.baseValue}) ÷ ${options.baseValue}) × 100 = ${value}`
    ],
    timestamp: Date.now()
  };
}

function calculatePercentageIncrease(options: PercentageCalculatorOptions): CalculationResult {
  const increase = (options.percentageValue / 100) * options.baseValue;
  const resultValue = options.baseValue + increase;

  return {
    ...options,
    value: resultValue,
    difference: options.includeDifference ? increase : undefined,
    steps: [
      `Input: Increase ${options.baseValue} by ${options.percentageValue}%`,
      `Increase amount: ${options.baseValue} × ${options.percentageValue}% = ${increase}`,
      `Result: ${options.baseValue} + ${increase} = ${resultValue}`
    ],
    timestamp: Date.now()
  };
}

function calculatePercentageDecrease(options: PercentageCalculatorOptions): CalculationResult {
  const decrease = (options.percentageValue / 100) * options.baseValue;
  const resultValue = options.baseValue - decrease;

  return {
    ...options,
    value: resultValue,
    difference: options.includeDifference ? decrease : undefined,
    steps: [
      `Input: Decrease ${options.baseValue} by ${options.percentageValue}%`,
      `Decrease amount: ${options.baseValue} × ${options.percentageValue}% = ${decrease}`,
      `Result: ${options.baseValue} - ${decrease} = ${resultValue}`
    ],
    timestamp: Date.now()
  };
}

export function resolvePercentageSuggestion(
  context: PercentageSuggestionContext
): MdToolSuggestion | null {
  const { hasResult, hasError, mode, percentageValue, baseValue } = context;

  if (hasError) {
    return {
      id: 'pc-validation',
      title: 'Check your percentage inputs',
      reason:
        'Base values cannot be zero for “what percent” or change modes. Fraction Calculator helps when you prefer ratios instead of percents.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  if (hasResult && mode === 'percentageOf' && percentageValue >= 15 && percentageValue <= 25) {
    return {
      id: 'pc-tip',
      title: 'Looks like a tip range',
      reason:
        'Tip Calculator splits the bill and tip across guests once you know the percent.',
      actionLabel: 'Open Tip Calculator',
      path: '/math-date-utils/tip-calculator'
    };
  }

  if (hasResult && mode === 'percentageDecrease') {
    return {
      id: 'pc-discount',
      title: 'Discount calculation ready',
      reason:
        'Tip Calculator also handles service charges after a discount. Number to Words helps on printed receipts.',
      actionLabel: 'Open Tip Calculator',
      path: '/math-date-utils/tip-calculator'
    };
  }

  if (hasResult && mode === 'percentageIncrease' && baseValue >= 10000) {
    return {
      id: 'pc-raise',
      title: 'Large base increase detected',
      reason:
        'Loan EMI Calculator can model how a salary change affects affordability and monthly payments.',
      actionLabel: 'Open Loan EMI Calculator',
      path: '/math-date-utils/loan-emi-calculator'
    };
  }

  if (hasResult && mode === 'isWhatPercent') {
    return {
      id: 'pc-progress',
      title: 'Progress as a percentage',
      reason:
        'Fraction Calculator can show the same ratio in lowest terms for reports or worksheets.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  if (hasResult && mode === 'percentageChange') {
    return {
      id: 'pc-change',
      title: 'Percentage change computed',
      reason:
        'Number to Words can spell out the change for slides, memos, or spoken updates.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && percentageValue >= PERCENTAGE_HIGH_THRESHOLD) {
    return {
      id: 'pc-high',
      title: 'Percent at or above 100%',
      reason:
        'Values over 100% may be markups or typos. Fraction Calculator helps verify the underlying ratio.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  if (hasResult) {
    return {
      id: 'pc-general',
      title: 'Need a related calculation?',
      reason:
        'Tip Calculator, Fraction Calculator, and Number to Words cover common next steps after a percent result.',
      actionLabel: 'Open Tip Calculator',
      path: '/math-date-utils/tip-calculator'
    };
  }

  return {
    id: 'pc-start',
    title: 'Pick a mode and enter values',
    reason:
      'Use presets for tax, discount, tip, or raises. Related tools help with tips, fractions, and wording.',
    actionLabel: 'Open Tip Calculator',
    path: '/math-date-utils/tip-calculator'
  };
}
