import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  FRACTION_DEFAULT_PRECISION,
  FRACTION_INTEGER_PATTERN,
  FRACTION_OPERATIONS
} from '../constants/fraction-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  Fraction,
  FractionCalculatorFormGroup,
  FractionComputation,
  FractionOperation,
  FractionOperationOptions,
  FractionSuggestionContext,
  MixedFraction
} from '../types/fraction-calculator.types';

export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return FRACTION_INTEGER_PATTERN.test(raw) ? null : { integer: true };
}

export function nonZeroValidator(control: AbstractControl): ValidationErrors | null {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw || !FRACTION_INTEGER_PATTERN.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10) === 0 ? { zero: true } : null;
}

export function toInteger(value: unknown): number {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return 0;
  }
  return Number.parseInt(raw, 10);
}

export function normalizeFraction(fraction: Fraction): Fraction {
  const { numerator, denominator } = fraction;
  if (denominator === 0) {
    throw new Error('Denominator must not be zero.');
  }
  if (numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const sign = denominator < 0 ? -1 : 1;
  return {
    numerator: numerator * sign,
    denominator: Math.abs(denominator)
  };
}

export function simplifyFraction(fraction: Fraction): Fraction {
  const normalized = normalizeFraction(fraction);
  if (normalized.numerator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const divisor = gcd(Math.abs(normalized.numerator), normalized.denominator);
  return {
    numerator: normalized.numerator / divisor,
    denominator: normalized.denominator / divisor
  };
}

export function performFractionOperation(
  left: Fraction,
  right: Fraction,
  operation: FractionOperation,
  options: FractionOperationOptions
): FractionComputation {
  const steps: string[] = [];
  let raw: Fraction;

  switch (operation) {
    case 'add': {
      const lcmValue = lcm(left.denominator, right.denominator);
      const scaledLeft = (lcmValue / left.denominator) * left.numerator;
      const scaledRight = (lcmValue / right.denominator) * right.numerator;
      if (options.showSteps) {
        steps.push(`LCM(${left.denominator}, ${right.denominator}) = ${lcmValue}`);
        steps.push(`${scaledLeft} + ${scaledRight} = ${scaledLeft + scaledRight}`);
      }
      raw = { numerator: scaledLeft + scaledRight, denominator: lcmValue };
      break;
    }
    case 'subtract': {
      const lcmValue = lcm(left.denominator, right.denominator);
      const scaledLeft = (lcmValue / left.denominator) * left.numerator;
      const scaledRight = (lcmValue / right.denominator) * right.numerator;
      if (options.showSteps) {
        steps.push(`LCM(${left.denominator}, ${right.denominator}) = ${lcmValue}`);
        steps.push(`${scaledLeft} − ${scaledRight} = ${scaledLeft - scaledRight}`);
      }
      raw = { numerator: scaledLeft - scaledRight, denominator: lcmValue };
      break;
    }
    case 'multiply': {
      if (options.showSteps) {
        steps.push(`${left.numerator} × ${right.numerator} = ${left.numerator * right.numerator}`);
        steps.push(
          `${left.denominator} × ${right.denominator} = ${left.denominator * right.denominator}`
        );
      }
      raw = {
        numerator: left.numerator * right.numerator,
        denominator: left.denominator * right.denominator
      };
      break;
    }
    case 'divide': {
      if (right.numerator === 0) {
        throw new Error('Cannot divide by a fraction with a zero numerator.');
      }
      if (options.showSteps) {
        steps.push(
          `Reciprocal of ${right.numerator}/${right.denominator} is ${right.denominator}/${right.numerator}`
        );
        steps.push(
          `${left.numerator} × ${right.denominator} = ${left.numerator * right.denominator}`
        );
        steps.push(
          `${left.denominator} × ${right.numerator} = ${left.denominator * right.numerator}`
        );
      }
      raw = {
        numerator: left.numerator * right.denominator,
        denominator: left.denominator * right.numerator
      };
      break;
    }
    default: {
      raw = { numerator: 0, denominator: 1 };
      break;
    }
  }

  const normalizedRaw = normalizeFraction(raw);
  const simplified = options.autoSimplify ? simplifyFraction(normalizedRaw) : normalizedRaw;
  const precision = clamp(
    Math.round(options.precision ?? FRACTION_DEFAULT_PRECISION),
    0,
    12
  );
  const decimalValue = simplified.numerator / simplified.denominator;
  const decimalFormatted = decimalValue.toFixed(precision);
  const mixed = toMixedFraction(simplified);
  const explanation = buildExplanation(operation, left, right, simplified);

  if (options.autoSimplify && options.showSteps) {
    const divisor = gcd(Math.abs(normalizedRaw.numerator), normalizedRaw.denominator);
    if (divisor > 1) {
      steps.push(`Simplify by dividing numerator and denominator by ${divisor}.`);
    }
  }

  return {
    operation,
    left,
    right,
    raw: normalizedRaw,
    simplified,
    decimalValue,
    decimalFormatted,
    mixed,
    steps,
    explanation
  };
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return (Math.abs(a) / gcd(Math.abs(a), Math.abs(b))) * Math.abs(b);
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function toMixedFraction(fraction: Fraction): MixedFraction | null {
  const simplified = simplifyFraction(fraction);
  const { numerator, denominator } = simplified;
  if (Math.abs(numerator) < denominator) {
    return {
      sign: numerator < 0 ? -1 : 1,
      whole: 0,
      numerator: Math.abs(numerator),
      denominator
    };
  }

  const absolute = Math.abs(numerator);
  const whole = Math.trunc(absolute / denominator);
  const remainder = absolute % denominator;
  return {
    sign: numerator < 0 ? -1 : 1,
    whole,
    numerator: remainder,
    denominator
  };
}

export function buildExplanation(
  operation: FractionOperation,
  left: Fraction,
  right: Fraction,
  result: Fraction
): string {
  const leftLabel = `${left.numerator}/${left.denominator}`;
  const rightLabel = `${right.numerator}/${right.denominator}`;
  const resultLabel = `${result.numerator}/${result.denominator}`;

  switch (operation) {
    case 'add':
      return `Added ${leftLabel} and ${rightLabel} to obtain ${resultLabel}.`;
    case 'subtract':
      return `Subtracted ${rightLabel} from ${leftLabel} to obtain ${resultLabel}.`;
    case 'multiply':
      return `Multiplied ${leftLabel} by ${rightLabel} to obtain ${resultLabel}.`;
    case 'divide':
      return `Divided ${leftLabel} by ${rightLabel} (multiplied by the reciprocal) to obtain ${resultLabel}.`;
    default:
      return 'Performed fraction operation.';
  }
}

export function buildInsights(result: FractionComputation): string[] {
  const insights: string[] = [];
  insights.push(result.explanation);
  if (result.mixed && result.mixed.whole > 0 && result.mixed.numerator !== 0) {
    const sign = result.mixed.sign < 0 ? '−' : '';
    insights.push(
      `Mixed form: ${sign}${result.mixed.whole} ${result.mixed.numerator}/${result.mixed.denominator}.`
    );
  } else if (result.mixed && result.mixed.numerator === 0) {
    insights.push(
      `Result is a whole number: ${result.mixed.sign < 0 ? '−' : ''}${result.mixed.whole}.`
    );
  }
  insights.push(`Decimal approximation: ${result.decimalFormatted}.`);
  if (
    result.raw.denominator !== result.simplified.denominator ||
    result.raw.numerator !== result.simplified.numerator
  ) {
    insights.push(
      `Simplified from ${result.raw.numerator}/${result.raw.denominator} to ${result.simplified.numerator}/${result.simplified.denominator}.`
    );
  }
  if (
    result.operation === 'divide' &&
    (result.right.numerator === 1 || result.right.denominator === 1)
  ) {
    insights.push('Division by a unit fraction translates to scaling by its denominator.');
  }
  return insights;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function collectFractionFormErrors(form: FractionCalculatorFormGroup): string[] {
  const messages: string[] = [];
  const controls = [
    { control: form.controls.fractionA.controls.numerator, label: 'Fraction A numerator' },
    { control: form.controls.fractionA.controls.denominator, label: 'Fraction A denominator' },
    { control: form.controls.fractionB.controls.numerator, label: 'Fraction B numerator' },
    { control: form.controls.fractionB.controls.denominator, label: 'Fraction B denominator' }
  ];

  for (const item of controls) {
    if (item.control.hasError('required')) {
      messages.push(`${item.label} is required.`);
    }
    if (item.control.hasError('integer')) {
      messages.push(`${item.label} must be an integer value.`);
    }
    if (item.control.hasError('zero')) {
      messages.push(`${item.label} must not be zero.`);
    }
  }

  if (form.controls.precision.hasError('min') || form.controls.precision.hasError('max')) {
    messages.push('Precision must be between 0 and 12 decimal places.');
  }

  return messages;
}

export function formatFractionDisplay(fraction: Fraction | null | undefined): string {
  if (!fraction) {
    return '—';
  }
  return `${fraction.numerator}/${fraction.denominator}`;
}

export function formatMixedDisplay(mixed: MixedFraction | null): string {
  if (!mixed) {
    return '—';
  }
  const sign = mixed.sign < 0 ? '−' : '';
  if (mixed.numerator === 0) {
    return `${sign}${mixed.whole}`;
  }
  const wholePart = mixed.whole === 0 ? '' : `${mixed.whole} `;
  return `${sign}${wholePart}${mixed.numerator}/${mixed.denominator}`;
}

export function operationSymbol(operation: FractionOperation): string {
  return FRACTION_OPERATIONS.find((item) => item.id === operation)?.symbol ?? '?';
}

export function formatFractionResultText(result: FractionComputation): string {
  return [
    `${formatFractionDisplay(result.left)} ${operationSymbol(result.operation)} ${formatFractionDisplay(result.right)} = ${formatFractionDisplay(result.simplified)}`,
    `Decimal: ${result.decimalFormatted}`,
    `Mixed: ${formatMixedDisplay(result.mixed)}`
  ].join('\n');
}

export function mapFractionCalculationError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to evaluate expression.';
}

export function resolveFractionSuggestion(
  context: FractionSuggestionContext
): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    operation,
    autoSimplify,
    isWholeNumber,
    isImproper,
    canSimplifyFurther
  } = context;

  if (hasError) {
    return {
      id: 'fc-validation',
      title: 'Check your fraction inputs',
      reason:
        'Numerators and denominators must be integers, and denominators cannot be zero. Percentage Calculator helps once you have a valid decimal.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && isWholeNumber) {
    return {
      id: 'fc-whole',
      title: 'Result is a whole number',
      reason:
        'Number to Words can spell out whole-number answers for worksheets or invoices.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && isImproper) {
    return {
      id: 'fc-mixed',
      title: 'Improper fraction detected',
      reason:
        'The mixed form is shown in the result panel. Percentage Calculator can turn the decimal into a percent for reporting.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && !autoSimplify && canSimplifyFurther) {
    return {
      id: 'fc-simplify-off',
      title: 'Auto simplify is off',
      reason:
        'This result can still reduce to lowest terms. Enable auto simplify, or check the decimal with Percentage Calculator.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && operation === 'divide') {
    return {
      id: 'fc-divide',
      title: 'Working with reciprocals?',
      reason:
        'Division flips the second fraction. Unit Converter is useful when that ratio scales real measurements.',
      actionLabel: 'Open Unit Converter',
      path: '/math-date-utils/unit-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'fc-percent',
      title: 'Need a percentage view?',
      reason:
        'Percentage Calculator converts the decimal result into percents for grades, recipes, or splits.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  return {
    id: 'fc-start',
    title: 'Enter two fractions',
    reason:
      'Pick an operation to see simplified, decimal, and mixed forms. Related math tools help after you have a result.',
    actionLabel: 'Open Percentage Calculator',
    path: '/math-date-utils/percentage-calculator'
  };
}
