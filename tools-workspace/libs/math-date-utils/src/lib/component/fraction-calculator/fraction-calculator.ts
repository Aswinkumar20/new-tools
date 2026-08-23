import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { debounceTime } from 'rxjs';
import {
  FRACTION_DEFAULT_FORM,
  FRACTION_DEFAULT_PRECISION,
  FRACTION_OPERATIONS,
  FRACTION_PRESETS,
  FRACTION_RELATED_TOOLS
} from '../../constants/fraction-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  Fraction,
  FractionCalculatorFormGroup,
  FractionCalculatorFormValues,
  FractionComputation,
  FractionFormGroup,
  FractionOperation,
  FractionPreset,
  MixedFraction
} from '../../types/fraction-calculator.types';
import {
  buildInsights,
  collectFractionFormErrors,
  formatFractionDisplay,
  formatFractionResultText,
  formatMixedDisplay,
  integerValidator,
  mapFractionCalculationError,
  nonZeroValidator,
  normalizeFraction,
  operationSymbol,
  performFractionOperation,
  resolveFractionSuggestion,
  simplifyFraction,
  toInteger
} from '../../utils/fraction-calculator.utils';

@Component({
  selector: 'lib-fraction-calculator',
  standalone: true,
  templateUrl: './fraction-calculator.html',
  styleUrls: ['./fraction-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FractionCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly operations = FRACTION_OPERATIONS;
  readonly presets = FRACTION_PRESETS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = FRACTION_RELATED_TOOLS;

  readonly form: FractionCalculatorFormGroup = this.fb.group({
    fractionA: this.createFractionGroup(FRACTION_DEFAULT_FORM.fractionA),
    fractionB: this.createFractionGroup(FRACTION_DEFAULT_FORM.fractionB),
    operation: this.fb.control<FractionOperation>(FRACTION_DEFAULT_FORM.operation, {
      nonNullable: true
    }),
    autoSimplify: this.fb.control(FRACTION_DEFAULT_FORM.autoSimplify, { nonNullable: true }),
    showSteps: this.fb.control(FRACTION_DEFAULT_FORM.showSteps, { nonNullable: true }),
    precision: this.fb.control(FRACTION_DEFAULT_PRECISION, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(12)]
    })
  });

  readonly computation = signal<FractionComputation | null>(null);
  readonly errors = signal<string[]>([]);
  readonly activePreset = signal<string | null>(null);
  readonly formSnapshot = signal<FractionCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly insights = computed(() => {
    const result = this.computation();
    return result ? buildInsights(result) : [];
  });

  readonly primarySuggestion = computed(() => {
    const result = this.computation();
    const snapshot = this.formSnapshot();
    const simplifiedFully = result ? simplifyFraction(result.raw) : null;
    const canSimplifyFurther = Boolean(
      result &&
        simplifiedFully &&
        (simplifiedFully.numerator !== result.raw.numerator ||
          simplifiedFully.denominator !== result.raw.denominator)
    );
    const isWholeNumber = Boolean(result?.mixed && result.mixed.numerator === 0);
    const isImproper = Boolean(
      result && Math.abs(result.simplified.numerator) > result.simplified.denominator
    );

    const suggestion = resolveFractionSuggestion({
      hasResult: result !== null,
      hasError: this.errors().length > 0,
      operation: snapshot.operation,
      autoSimplify: snapshot.autoSimplify,
      isWholeNumber,
      isImproper,
      canSimplifyFurther
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(120), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.recalculateFraction();
    });

    this.recalculateFraction();
  }

  setOperation(operation: FractionOperation): void {
    this.form.patchValue({ operation });
    this.toast.info(
      `Operation set to ${FRACTION_OPERATIONS.find((item) => item.id === operation)?.label ?? operation}.`
    );
  }

  swapFractions(): void {
    const a = this.form.controls.fractionA.getRawValue();
    const b = this.form.controls.fractionB.getRawValue();
    this.form.patchValue({
      fractionA: { numerator: b.numerator, denominator: b.denominator },
      fractionB: { numerator: a.numerator, denominator: a.denominator }
    });
    this.toast.info('Fractions swapped.');
  }

  reset(): void {
    this.form.reset(
      {
        fractionA: { ...FRACTION_DEFAULT_FORM.fractionA },
        fractionB: { ...FRACTION_DEFAULT_FORM.fractionB },
        operation: FRACTION_DEFAULT_FORM.operation,
        autoSimplify: FRACTION_DEFAULT_FORM.autoSimplify,
        showSteps: FRACTION_DEFAULT_FORM.showSteps,
        precision: FRACTION_DEFAULT_PRECISION
      },
      { emitEvent: true }
    );
    this.activePreset.set(null);
    this.toast.info('Reset to default values.');
  }

  async copyResult(): Promise<void> {
    const current = this.computation();
    if (!current) {
      return;
    }
    await mdCopyText(this.toast, formatFractionResultText(current), 'Result');
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
    this.toast.info(`${preset.label} preset applied.`);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  trackPreset(index: number, preset: FractionPreset): string {
    return preset.id ?? `preset-${index}`;
  }

  operationSymbol(operation: FractionOperation): string {
    return operationSymbol(operation);
  }

  formatFraction(fraction: Fraction | null | undefined): string {
    return formatFractionDisplay(fraction);
  }

  formatMixed(mixed: MixedFraction | null): string {
    return formatMixedDisplay(mixed);
  }

  private recalculateFraction(): void {
    if (this.form.invalid) {
      this.errors.set(collectFractionFormErrors(this.form));
      this.computation.set(null);
      return;
    }

    const { operation, autoSimplify, showSteps, precision } = this.form.getRawValue();
    const left = this.getFractionValue(this.form.controls.fractionA);
    const right = this.getFractionValue(this.form.controls.fractionB);

    try {
      const result = performFractionOperation(left, right, operation ?? 'add', {
        autoSimplify: autoSimplify ?? true,
        showSteps: showSteps ?? true,
        precision: precision ?? FRACTION_DEFAULT_PRECISION
      });
      this.computation.set(result);
      this.errors.set([]);
    } catch (error) {
      this.computation.set(null);
      this.errors.set([mapFractionCalculationError(error)]);
    }
  }

  private createFractionGroup(defaults: {
    numerator: string;
    denominator: string;
  }): FractionFormGroup {
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

  private readFormValues(): FractionCalculatorFormValues {
    const raw = this.form.getRawValue();
    return {
      fractionA: {
        numerator: raw.fractionA.numerator ?? '',
        denominator: raw.fractionA.denominator ?? ''
      },
      fractionB: {
        numerator: raw.fractionB.numerator ?? '',
        denominator: raw.fractionB.denominator ?? ''
      },
      operation: raw.operation,
      autoSimplify: raw.autoSimplify,
      showSteps: raw.showSteps,
      precision: raw.precision
    };
  }
}
