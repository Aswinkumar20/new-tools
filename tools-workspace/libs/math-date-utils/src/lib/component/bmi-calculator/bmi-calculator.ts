import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { Subscription, debounceTime } from 'rxjs';
import {
  BMI_DEFAULT_FORM,
  BMI_HISTORY_LIMIT,
  BMI_PRESETS,
  BMI_RELATED_TOOLS,
  BMI_UNIT_OPTIONS
} from '../../constants/bmi-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  BmiCalculatorFormGroup,
  BmiCalculatorFormValues,
  BmiHistory,
  BmiPreset,
  BmiResult,
  RiskIndicator,
  UnitOption,
  UnitSystem
} from '../../types/bmi-calculator.types';
import {
  buildBmiInputFromValues,
  calculateBmi,
  convertUnits,
  formatBmiResultText,
  formatHeightDisplay,
  formatWeightDisplay,
  hasHighWaistRisk,
  mapBmiCalculationError,
  numberValidator,
  prependBmiHistory,
  resolveBmiSuggestion,
  toNumber
} from '../../utils/bmi-calculator.utils';

@Component({
  selector: 'lib-bmi-calculator',
  standalone: true,
  templateUrl: './bmi-calculator.html',
  styleUrls: ['./bmi-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BmiCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private readonly subscriptions = new Subscription();

  readonly units = BMI_UNIT_OPTIONS;
  readonly presets = BMI_PRESETS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = BMI_RELATED_TOOLS;

  readonly form: BmiCalculatorFormGroup = this.fb.group({
    unit: this.fb.control<UnitSystem>(BMI_DEFAULT_FORM.unit, { nonNullable: true }),
    weight: this.fb.control(BMI_DEFAULT_FORM.weight, [Validators.required, numberValidator]),
    height: this.fb.control(BMI_DEFAULT_FORM.height, [Validators.required, numberValidator]),
    age: this.fb.control(BMI_DEFAULT_FORM.age, [numberValidator]),
    gender: this.fb.control(BMI_DEFAULT_FORM.gender, { nonNullable: true }),
    waist: this.fb.control(BMI_DEFAULT_FORM.waist, [numberValidator]),
    includeHistory: this.fb.control(BMI_DEFAULT_FORM.includeHistory, { nonNullable: true })
  });

  readonly result = signal<BmiResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<BmiHistory[]>([]);
  readonly formSnapshot = signal<BmiCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly activeUnit = computed(
    () =>
      this.units.find((option) => option.id === this.formSnapshot().unit) ?? BMI_UNIT_OPTIONS[0]
  );

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly breakdown = computed(() => this.result()?.breakdown ?? null);
  readonly recommendations = computed(() => this.result()?.recommendations ?? []);
  readonly riskIndicators = computed(() => this.result()?.riskIndicators ?? []);

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const input = buildBmiInputFromValues(snapshot);
    const suggestion = resolveBmiSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      categoryId: current?.summary.classification.id ?? null,
      age: input.age,
      hasWaist: Boolean(input.waist),
      hasHighWaistRisk: hasHighWaistRisk(input),
      unit: snapshot.unit
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.subscriptions.add(
      this.form.valueChanges.subscribe(() => {
        this.formSnapshot.set(this.readFormValues());
      })
    );

    this.subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(80)).subscribe(() => {
        this.recalculateBmi();
      })
    );

    this.recalculateBmi();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  setUnit(unit: UnitSystem): void {
    const previousUnit = this.form.controls.unit.value;
    if (unit === previousUnit) {
      return;
    }

    const converted = convertUnits({
      from: previousUnit,
      to: unit,
      weight: toNumber(this.form.controls.weight.value),
      height: toNumber(this.form.controls.height.value)
    });

    this.form.patchValue(
      {
        unit,
        weight: converted.weight.toString(),
        height: converted.height.toString()
      },
      { emitEvent: true }
    );
    this.toast.info(`Switched to ${unit === 'metric' ? 'metric' : 'imperial'} units.`);
  }

  applyPreset(preset: BmiPreset): void {
    this.form.patchValue(
      {
        unit: preset.unit,
        weight: preset.weight,
        height: preset.height,
        age: preset.age ?? this.form.controls.age.value ?? '',
        gender: preset.gender ?? this.form.controls.gender.value,
        waist: preset.waist ?? this.form.controls.waist.value ?? ''
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.recalculateBmi();
    this.toast.info('BMI recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  async copyResult(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    await mdCopyText(this.toast, formatBmiResultText(current), 'Result');
  }

  restoreHistory(entry: BmiHistory): void {
    this.form.patchValue(
      {
        unit: entry.unit,
        weight: entry.weight.toString(),
        height: entry.height.toString(),
        age: entry.age?.toString() ?? '',
        gender: entry.gender,
        waist: entry.waist?.toString() ?? ''
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatWeight(value: number, unit: UnitSystem = this.formSnapshot().unit): string {
    return formatWeightDisplay(value, unit);
  }

  formatHeight(value: number, unit: UnitSystem = this.formSnapshot().unit): string {
    return formatHeightDisplay(value, unit);
  }

  absoluteWeightDifference(value: number): number {
    return Math.abs(value);
  }

  readonly trackUnit = (_: number, option: UnitOption) => option.id;
  readonly trackPreset = (_: number, preset: BmiPreset) => preset.label;
  readonly trackRecommendation = (_: number, tip: string) => tip;
  readonly trackRisk = (_: number, risk: RiskIndicator) => risk.label;
  readonly trackHistory = (_: number, entry: BmiHistory) =>
    `${entry.unit}-${entry.weight}-${entry.height}`;

  private readFormValues(): BmiCalculatorFormValues {
    const raw = this.form.getRawValue();
    return {
      unit: raw.unit,
      weight: raw.weight ?? BMI_DEFAULT_FORM.weight,
      height: raw.height ?? BMI_DEFAULT_FORM.height,
      age: raw.age ?? '',
      gender: raw.gender,
      waist: raw.waist ?? '',
      includeHistory: raw.includeHistory
    };
  }

  private recalculateBmi(): void {
    this.errorMessage.set(null);
    const snapshot = this.readFormValues();

    try {
      const input = buildBmiInputFromValues(snapshot);
      const nextResult = calculateBmi(input);
      this.result.set(nextResult);

      if (snapshot.includeHistory) {
        this.history.update((current) =>
          prependBmiHistory(
            current,
            {
              ...nextResult,
              unit: input.unit,
              weight: input.weight,
              height: input.height,
              age: input.age,
              gender: input.gender,
              waist: input.waist
            },
            BMI_HISTORY_LIMIT
          )
        );
      }
    } catch (error) {
      this.errorMessage.set(mapBmiCalculationError(error));
      this.result.set(null);
    }
  }
}
