import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, Signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

@Component({
  selector: 'lib-percentage-calculator',
  standalone: true,
  templateUrl: './percentage-calculator.html',
  styleUrls: ['./percentage-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation]
})
export class PercentageCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly calculationSubscription: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly modes = MODES;
  readonly presets = PRESETS;
  readonly advancedOptions = ADVANCED_OPTIONS;

  readonly form = this.fb.group({
    mode: this.fb.control<CalculatorMode>('percentageOf', { nonNullable: true }),
    baseValue: this.fb.control('120', [Validators.required, numberValidator]),
    percentageValue: this.fb.control('20', [Validators.required, numberValidator]),
    resultValue: this.fb.control('24', [numberValidator]),
    increaseDecreaseValue: this.fb.control('15', [numberValidator]),
    decimalPlaces: this.fb.control(2, { nonNullable: true }),
    showSteps: this.fb.control(true, { nonNullable: true }),
    roundResult: this.fb.control(false, { nonNullable: true }),
    includeDifference: this.fb.control(true, { nonNullable: true })
  });

  readonly activeMode: Signal<ModeDefinition> = computed(
    () => this.modes.find((mode) => mode.id === this.form.get('mode')!.value) ?? MODES[0]
  );

  readonly result: WritableSignal<CalculationResult | null> = signal(null);
  readonly history: WritableSignal<CalculationHistory[]> = signal([]);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isCopied = signal(false);

  readonly formattedResult = computed(() => {
    const current = this.result();
    if (!current) {
      return '';
    }

    const digits = this.form.get('decimalPlaces')?.value ?? 2;
    return formatNumber(current.value, digits, this.form.get('roundResult')?.value ?? false);
  });

  readonly differenceResult = computed(() => {
    const current = this.result();
    const difference = current?.difference;

    if (difference === undefined) {
      return null;
    }

    const digits = this.form.get('decimalPlaces')?.value ?? 2;
    return formatNumber(difference, digits, this.form.get('roundResult')?.value ?? false);
  });

  readonly displaySteps = computed(() => {
    const current = this.result();
    return current?.steps ?? [];
  });

  readonly chartData = computed(() => {
    const current = this.result();
    if (!current) {
      return null;
    }

    return {
      slices: [
        { label: 'Base', value: current.baseValue },
        { label: 'Change', value: current.value }
      ],
      total: current.baseValue + current.value
    };
  });

  readonly requiresPercentageValue = computed(() => this.activeMode().requiredFields.includes('percentageValue'));
  readonly requiresResultValue = computed(() => this.activeMode().requiredFields.includes('resultValue'));
  readonly requiresIncreaseDecreaseValue = computed(() => this.activeMode().requiredFields.includes('increaseDecreaseValue'));
  readonly requiresBaseValue = computed(() => this.activeMode().requiredFields.includes('baseValue'));

  constructor() {
    this.calculationSubscription = this.form.valueChanges
      .pipe(debounceTime(80), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const current = this.activeMode();
        if (!current) {
          return;
        }

        for (const field of current.requiredFields) {
          const control = this.form.get(field);
          if (control) {
            control.addValidators([Validators.required, numberValidator]);
          }
        }
      })
    );

    this.calculate();
  }

  ngOnDestroy(): void {
    this.calculationSubscription.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  setMode(mode: CalculatorMode): void {
    if (mode === this.form.get('mode')!.value) {
      return;
    }
    this.form.patchValue({ mode }, { emitEvent: true });
    this.notify(`Mode switched to ${this.activeMode().label}.`);
  }

  applyPreset(preset: PresetDefinition): void {
    this.form.patchValue(
      {
        mode: preset.mode,
        baseValue: preset.baseValue,
        percentageValue: preset.percentageValue,
        resultValue: preset.resultValue ?? this.form.get('resultValue')!.value,
        increaseDecreaseValue: preset.increaseDecreaseValue ?? this.form.get('increaseDecreaseValue')!.value
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Calculation refreshed.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  resetToDefault(): void {
    this.form.patchValue({
      mode: 'percentageOf',
      baseValue: '120',
      percentageValue: '20',
      resultValue: '24',
      increaseDecreaseValue: '15',
      decimalPlaces: 2,
      showSteps: true,
      roundResult: false,
      includeDifference: true
    }, { emitEvent: true });
    this.notify('Reset to default values.');
  }

  restoreHistory(entry: CalculationHistory): void {
    this.form.patchValue(
      {
        mode: entry.mode,
        baseValue: entry.baseValue.toString(),
        percentageValue: entry.percentageValue.toString(),
        resultValue: entry.resultValue.toString(),
        increaseDecreaseValue: entry.increaseDecreaseValue.toString(),
        decimalPlaces: entry.decimalPlaces,
        showSteps: entry.showSteps,
        roundResult: entry.roundResult,
        includeDifference: entry.includeDifference
      },
      { emitEvent: true }
    );
    this.notify('History entry restored.');
  }

  copyResult(): void {
    const value = this.formattedResult();
    if (!value) {
      this.notify('No result to copy yet.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(() => {
          this.isCopied.set(true);
          this.notify('Result copied to clipboard.');
        })
        .catch(() => this.notify('Clipboard unavailable.'));
      return;
    }

    this.notify('Clipboard unavailable in this environment.');
  }

  private calculate(): void {
    const mode = this.form.get('mode')!.value ?? 'percentageOf';
    const baseValue = toNumber(this.form.get('baseValue')!.value);
    const percentageValue = toNumber(this.form.get('percentageValue')!.value);
    const resultValue = toNumber(this.form.get('resultValue')!.value);
    const increaseDecreaseValue = toNumber(this.form.get('increaseDecreaseValue')!.value);
    const includeDifference = this.form.get('includeDifference')?.value ?? true;
    const showSteps = this.form.get('showSteps')?.value ?? true;

    this.errorMessage.set(null);

    try {
      const calculator = new PercentageCalculator();
      const calculation = calculator.compute({
        mode,
        baseValue,
        percentageValue,
        resultValue,
        increaseDecreaseValue,
        includeDifference,
        showSteps
      });

      this.result.set(calculation);
      this.pushHistory(calculation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete calculation.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(entry: CalculationResult): void {
    const historyEntry: CalculationHistory = {
      ...entry,
      decimalPlaces: this.form.get('decimalPlaces')?.value ?? 2,
      roundResult: this.form.get('roundResult')?.value ?? false
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) =>
          !(
            item.baseValue === historyEntry.baseValue &&
            item.percentageValue === historyEntry.percentageValue &&
            item.mode === historyEntry.mode
          )
      );
      const next = [historyEntry, ...filtered];
      return next.slice(0, 10);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3000);
  }

  formatDisplay(value: number, digits: number, round: boolean): string {
    return formatNumber(value, digits, round);
  }

  getModeLabel(mode: CalculatorMode): string {
    return this.modes.find((item) => item.id === mode)?.label ?? mode;
  }

  readonly trackMode = (_: number, mode: ModeDefinition) => mode.id;
  readonly trackPreset = (_: number, preset: PresetDefinition) => preset.label;
  readonly trackStep = (_: number, step: string) => step;
  readonly trackHistory = (_: number, entry: CalculationHistory) => `${entry.mode}-${entry.timestamp}`;
}

type CalculatorMode = 'percentageOf' | 'isWhatPercent' | 'percentageChange' | 'percentageIncrease' | 'percentageDecrease';

interface ModeDefinition {
  id: CalculatorMode;
  label: string;
  description: string;
  icon: string;
  requiredFields: Array<'baseValue' | 'percentageValue' | 'resultValue' | 'increaseDecreaseValue'>;
}

interface PresetDefinition {
  label: string;
  mode: CalculatorMode;
  baseValue: string;
  percentageValue: string;
  resultValue?: string;
  increaseDecreaseValue?: string;
}

type AdvancedOptionId = 'roundResult' | 'includeDifference' | 'showSteps';

interface AdvancedOption {
  id: AdvancedOptionId;
  label: string;
  description: string;
}

interface PercentageCalculatorOptions {
  mode: CalculatorMode;
  baseValue: number;
  percentageValue: number;
  resultValue: number;
  increaseDecreaseValue: number;
  includeDifference: boolean;
  showSteps: boolean;
}

interface CalculationResult extends PercentageCalculatorOptions {
  value: number;
  difference?: number;
  steps?: string[];
  timestamp: number;
}

interface CalculationHistory extends CalculationResult {
  decimalPlaces: number;
  roundResult: boolean;
}

const MODES: ModeDefinition[] = [
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

const PRESETS: PresetDefinition[] = [
  { label: 'Sales tax (8.25%)', mode: 'percentageOf', baseValue: '89.99', percentageValue: '8.25' },
  { label: 'Discount (25%)', mode: 'percentageDecrease', baseValue: '120', percentageValue: '25' },
  { label: 'Tip (18%)', mode: 'percentageOf', baseValue: '56.40', percentageValue: '18' },
  { label: 'Progress completion', mode: 'isWhatPercent', baseValue: '200', resultValue: '65', percentageValue: '0' },
  { label: 'Salary raise', mode: 'percentageIncrease', baseValue: '65000', percentageValue: '12' }
];

const ADVANCED_OPTIONS: AdvancedOption[] = [
  { id: 'roundResult', label: 'Round result', description: 'Round to nearest integer after applying decimal precision.' },
  { id: 'includeDifference', label: 'Show difference', description: 'Show absolute change in addition to the percentage value.' },
  { id: 'showSteps', label: 'Display steps', description: 'Show formula steps for the calculation.' }
];

class PercentageCalculator {
  compute(options: PercentageCalculatorOptions): CalculationResult {
    switch (options.mode) {
      case 'percentageOf':
        return this.calculatePercentageOf(options);
      case 'isWhatPercent':
        return this.calculateIsWhatPercent(options);
      case 'percentageChange':
        return this.calculatePercentageChange(options);
      case 'percentageIncrease':
        return this.calculatePercentageIncrease(options);
      case 'percentageDecrease':
        return this.calculatePercentageDecrease(options);
      default:
        throw new Error('Unsupported calculation mode.');
    }
  }

  private calculatePercentageOf(options: PercentageCalculatorOptions): CalculationResult {
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

  private calculateIsWhatPercent(options: PercentageCalculatorOptions): CalculationResult {
    if (options.baseValue === 0) {
      throw new Error('Base value cannot be zero for this calculation.');
    }

    const value = (options.resultValue / options.baseValue) * 100;
    const difference = options.includeDifference ? options.resultValue - options.baseValue : undefined;

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

  private calculatePercentageChange(options: PercentageCalculatorOptions): CalculationResult {
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

  private calculatePercentageIncrease(options: PercentageCalculatorOptions): CalculationResult {
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

  private calculatePercentageDecrease(options: PercentageCalculatorOptions): CalculationResult {
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
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalised = value.split(',').join('').trim();
    return normalised ? Number(normalised) : 0;
  }

  return 0;
}

function numberValidator(control: import('@angular/forms').AbstractControl) {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? null : { number: true };
}

function formatNumber(value: number, digits: number, shouldRound: boolean): string {
  const precisionValue = shouldRound ? Math.round(value) : Number(value.toFixed(digits));
  return precisionValue.toLocaleString(undefined, {
    minimumFractionDigits: shouldRound ? 0 : digits,
    maximumFractionDigits: shouldRound ? 0 : digits
  });
}
