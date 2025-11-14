import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Navigation } from '@tools-workspace/features-home';

type FractionOperation = 'add' | 'subtract' | 'multiply' | 'divide';

interface Fraction {
  numerator: number;
  denominator: number;
}

interface MixedFraction {
  sign: 1 | -1;
  whole: number;
  numerator: number;
  denominator: number;
}

type FractionFormGroup = FormGroup<{
  numerator: FormControl<string | null>;
  denominator: FormControl<string | null>;
}>;

interface FractionComputation {
  operation: FractionOperation;
  left: Fraction;
  right: Fraction;
  raw: Fraction;
  simplified: Fraction;
  decimalValue: number;
  decimalFormatted: string;
  mixed: MixedFraction | null;
  steps: string[];
  explanation: string;
}

interface FractionPreset {
  id: string;
  label: string;
  operation: FractionOperation;
  left: { numerator: string; denominator: string };
  right: { numerator: string; denominator: string };
  description: string;
}

const INTEGER_PATTERN = /^-?\d+$/;
const DEFAULT_PRECISION = 4;

const FRACTION_PRESETS: FractionPreset[] = [
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

@Component({
  selector: 'lib-fraction-calculator',
  standalone: true,
  templateUrl: './fraction-calculator.html',
  styleUrls: ['./fraction-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FractionCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly operations: ReadonlyArray<{ id: FractionOperation; label: string; symbol: string; helper: string }> = [
    { id: 'add', label: 'Addition', symbol: '+', helper: 'Find a common denominator and add numerators.' },
    { id: 'subtract', label: 'Subtraction', symbol: '−', helper: 'Align denominators then subtract numerators.' },
    { id: 'multiply', label: 'Multiplication', symbol: '×', helper: 'Multiply across numerators and denominators.' },
    { id: 'divide', label: 'Division', symbol: '÷', helper: 'Multiply by the reciprocal of the second fraction.' }
  ];

  readonly presets = FRACTION_PRESETS;

  readonly form = this.fb.group({
    fractionA: this.createFractionGroup({ numerator: '3', denominator: '4' }),
    fractionB: this.createFractionGroup({ numerator: '2', denominator: '5' }),
    operation: this.fb.control<FractionOperation>('add', { nonNullable: true }),
    autoSimplify: this.fb.control(true, { nonNullable: true }),
    showSteps: this.fb.control(true, { nonNullable: true }),
    precision: this.fb.control(DEFAULT_PRECISION, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(12)]
    })
  });

  readonly computation: WritableSignal<FractionComputation | null> = signal(null);
  readonly errors = signal<string[]>([]);
  readonly activePreset = signal<string | null>(null);
  readonly insights = computed(() => {
    const result = this.computation();
    if (!result) {
      return [];
    }
    return buildInsights(result);
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculate());

    this.calculate();
  }

  setOperation(operation: FractionOperation): void {
    this.form.patchValue({ operation });
  }

  swapFractions(): void {
    const a = this.form.controls.fractionA.getRawValue();
    const b = this.form.controls.fractionB.getRawValue();
    this.form.patchValue({
      fractionA: { numerator: b.numerator, denominator: b.denominator },
      fractionB: { numerator: a.numerator, denominator: a.denominator }
    });
  }

  reset(): void {
    this.form.reset(
      {
        fractionA: { numerator: '3', denominator: '4' },
        fractionB: { numerator: '2', denominator: '5' },
        operation: 'add',
        autoSimplify: true,
        showSteps: true,
        precision: DEFAULT_PRECISION
      },
      { emitEvent: true }
    );
    this.activePreset.set(null);
  }

  applyPreset(presetId: string): void {
    const preset = this.presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    this.form.patchValue(
      {
        fractionA: { ...preset.left },
        fractionB: { ...preset.right },
        operation: preset.operation
      },
      { emitEvent: true }
    );
    this.activePreset.set(preset.label);
  }

  trackPreset(index: number, preset: FractionPreset): string {
    return preset.id ?? `preset-${index}`;
  }

  operationSymbol(operation: FractionOperation): string {
    return this.operations.find((item) => item.id === operation)?.symbol ?? '?';
  }

  formatFraction(fraction: Fraction | null | undefined): string {
    if (!fraction) {
      return '—';
    }
    return `${fraction.numerator}/${fraction.denominator}`;
  }

  formatMixed(mixed: MixedFraction | null): string {
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

  private calculate(): void {
    if (this.form.invalid) {
      this.errors.set(collectErrors(this.form));
      this.computation.set(null);
      return;
    }

    const { operation, autoSimplify, showSteps, precision } = this.form.getRawValue();
    const left = this.getFractionValue(this.form.controls.fractionA);
    const right = this.getFractionValue(this.form.controls.fractionB);

    try {
      const result = performOperation(left, right, operation ?? 'add', {
        autoSimplify: autoSimplify ?? true,
        showSteps: showSteps ?? true,
        precision: precision ?? DEFAULT_PRECISION
      });
      this.computation.set(result);
      this.errors.set([]);
    } catch (error) {
      this.computation.set(null);
      this.errors.set([error instanceof Error ? error.message : 'Unable to evaluate expression.']);
    }
  }

  private createFractionGroup(defaults: { numerator: string; denominator: string }): FractionFormGroup {
    return this.fb.group({
      numerator: this.fb.control<string | null>(defaults.numerator, {
        validators: [Validators.required, integerValidator],
        nonNullable: false
      }),
      denominator: this.fb.control<string | null>(defaults.denominator, {
        validators: [Validators.required, integerValidator, nonZeroValidator],
        nonNullable: false
      })
    });
  }

  private getFractionValue(group: FractionFormGroup): Fraction {
    const numerator = toInteger(group.controls.numerator.value);
    const denominator = toInteger(group.controls.denominator.value);
    return normalizeFraction({ numerator, denominator });
  }
}

function integerValidator(control: import('@angular/forms').AbstractControl) {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return INTEGER_PATTERN.test(raw) ? null : { integer: true };
}

function nonZeroValidator(control: import('@angular/forms').AbstractControl) {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw || !INTEGER_PATTERN.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10) === 0 ? { zero: true } : null;
}

function toInteger(value: unknown): number {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return 0;
  }
  return Number.parseInt(raw, 10);
}

function normalizeFraction(fraction: Fraction): Fraction {
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

function simplifyFraction(fraction: Fraction): Fraction {
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

function performOperation(
  left: Fraction,
  right: Fraction,
  operation: FractionOperation,
  options: { autoSimplify: boolean; showSteps: boolean; precision: number }
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
        steps.push(`${left.denominator} × ${right.denominator} = ${left.denominator * right.denominator}`);
      }
      raw = { numerator: left.numerator * right.numerator, denominator: left.denominator * right.denominator };
      break;
    }
    case 'divide': {
      if (right.numerator === 0) {
        throw new Error('Cannot divide by a fraction with a zero numerator.');
      }
      if (options.showSteps) {
        steps.push(`Reciprocal of ${right.numerator}/${right.denominator} is ${right.denominator}/${right.numerator}`);
        steps.push(`${left.numerator} × ${right.denominator} = ${left.numerator * right.denominator}`);
        steps.push(`${left.denominator} × ${right.numerator} = ${left.denominator * right.numerator}`);
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
  const precision = clamp(Math.round(options.precision ?? DEFAULT_PRECISION), 0, 12);
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

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return (Math.abs(a) / gcd(Math.abs(a), Math.abs(b))) * Math.abs(b);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function toMixedFraction(fraction: Fraction): MixedFraction | null {
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

function buildExplanation(operation: FractionOperation, left: Fraction, right: Fraction, result: Fraction): string {
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

function buildInsights(result: FractionComputation): string[] {
  const insights: string[] = [];
  insights.push(result.explanation);
  if (result.mixed && result.mixed.whole > 0 && result.mixed.numerator !== 0) {
    const sign = result.mixed.sign < 0 ? '−' : '';
    insights.push(
      `Mixed form: ${sign}${result.mixed.whole} ${result.mixed.numerator}/${result.mixed.denominator}.`
    );
  } else if (result.mixed && result.mixed.numerator === 0) {
    insights.push(`Result is a whole number: ${result.mixed.sign < 0 ? '−' : ''}${result.mixed.whole}.`);
  }
  insights.push(`Decimal approximation: ${result.decimalFormatted}.`);
  if (result.raw.denominator !== result.simplified.denominator || result.raw.numerator !== result.simplified.numerator) {
    insights.push(
      `Simplified from ${result.raw.numerator}/${result.raw.denominator} to ${result.simplified.numerator}/${result.simplified.denominator}.`
    );
  }
  if (result.operation === 'divide' && (result.right.numerator === 1 || result.right.denominator === 1)) {
    insights.push('Division by a unit fraction translates to scaling by its denominator.');
  }
  return insights;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function collectErrors(
  form: FormGroup<{
    fractionA: FractionFormGroup;
    fractionB: FractionFormGroup;
    operation: FormControl<FractionOperation>;
    autoSimplify: FormControl<boolean>;
    showSteps: FormControl<boolean>;
    precision: FormControl<number>;
  }>
): string[] {
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
