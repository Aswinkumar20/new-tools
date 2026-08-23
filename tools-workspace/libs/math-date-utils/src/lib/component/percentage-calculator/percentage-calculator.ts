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
  PERCENTAGE_ADVANCED_OPTIONS,
  PERCENTAGE_DEFAULT_FORM,
  PERCENTAGE_HISTORY_LIMIT,
  PERCENTAGE_MODES,
  PERCENTAGE_PRESETS,
  PERCENTAGE_RELATED_TOOLS
} from '../../constants/percentage-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  CalculationHistory,
  CalculationResult,
  CalculatorMode,
  ModeDefinition,
  PercentageCalculatorFormGroup,
  PercentageCalculatorFormValues,
  PresetDefinition
} from '../../types/percentage-calculator.types';
import {
  computePercentage,
  formatPercentageNumber,
  getPercentageModeLabel,
  mapPercentageCalculationError,
  numberValidator,
  resolvePercentageMode,
  resolvePercentageSuggestion,
  toNumber
} from '../../utils/percentage-calculator.utils';

@Component({
  selector: 'lib-percentage-calculator',
  standalone: true,
  templateUrl: './percentage-calculator.html',
  styleUrls: ['./percentage-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PercentageCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly modes = PERCENTAGE_MODES;
  readonly presets = PERCENTAGE_PRESETS;
  readonly advancedOptions = PERCENTAGE_ADVANCED_OPTIONS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = PERCENTAGE_RELATED_TOOLS;

  readonly form: PercentageCalculatorFormGroup = this.fb.group({
    mode: this.fb.control<CalculatorMode>(PERCENTAGE_DEFAULT_FORM.mode, { nonNullable: true }),
    baseValue: this.fb.control(PERCENTAGE_DEFAULT_FORM.baseValue, [
      Validators.required,
      numberValidator
    ]),
    percentageValue: this.fb.control(PERCENTAGE_DEFAULT_FORM.percentageValue, [
      Validators.required,
      numberValidator
    ]),
    resultValue: this.fb.control(PERCENTAGE_DEFAULT_FORM.resultValue, [numberValidator]),
    increaseDecreaseValue: this.fb.control(PERCENTAGE_DEFAULT_FORM.increaseDecreaseValue, [
      numberValidator
    ]),
    decimalPlaces: this.fb.control(PERCENTAGE_DEFAULT_FORM.decimalPlaces, { nonNullable: true }),
    showSteps: this.fb.control(PERCENTAGE_DEFAULT_FORM.showSteps, { nonNullable: true }),
    roundResult: this.fb.control(PERCENTAGE_DEFAULT_FORM.roundResult, { nonNullable: true }),
    includeDifference: this.fb.control(PERCENTAGE_DEFAULT_FORM.includeDifference, {
      nonNullable: true
    })
  });

  readonly result = signal<CalculationResult | null>(null);
  readonly history = signal<CalculationHistory[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly formSnapshot = signal<PercentageCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly activeMode = computed(() => resolvePercentageMode(this.formSnapshot().mode));

  readonly formattedResult = computed(() => {
    const current = this.result();
    if (!current) {
      return '';
    }
    const snapshot = this.formSnapshot();
    return formatPercentageNumber(current.value, snapshot.decimalPlaces, snapshot.roundResult);
  });

  readonly differenceResult = computed(() => {
    const current = this.result();
    const difference = current?.difference;
    if (difference === undefined) {
      return null;
    }
    const snapshot = this.formSnapshot();
    return formatPercentageNumber(difference, snapshot.decimalPlaces, snapshot.roundResult);
  });

  readonly displaySteps = computed(() => this.result()?.steps ?? []);

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

  readonly requiresPercentageValue = computed(() =>
    this.activeMode().requiredFields.includes('percentageValue')
  );
  readonly requiresResultValue = computed(() =>
    this.activeMode().requiredFields.includes('resultValue')
  );
  readonly requiresIncreaseDecreaseValue = computed(() =>
    this.activeMode().requiredFields.includes('increaseDecreaseValue')
  );
  readonly requiresBaseValue = computed(() =>
    this.activeMode().requiredFields.includes('baseValue')
  );

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const suggestion = resolvePercentageSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      mode: snapshot.mode,
      percentageValue: toNumber(snapshot.percentageValue),
      baseValue: toNumber(snapshot.baseValue),
      resultValue: toNumber(snapshot.resultValue)
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(80), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.calculate();
    });

    this.calculate();
  }

  setMode(mode: CalculatorMode): void {
    if (mode === this.form.controls.mode.value) {
      return;
    }
    this.form.patchValue({ mode }, { emitEvent: true });
    this.toast.info(`Mode switched to ${getPercentageModeLabel(mode)}.`);
  }

  applyPreset(preset: PresetDefinition): void {
    this.form.patchValue(
      {
        mode: preset.mode,
        baseValue: preset.baseValue,
        percentageValue: preset.percentageValue,
        resultValue: preset.resultValue ?? this.form.controls.resultValue.value,
        increaseDecreaseValue:
          preset.increaseDecreaseValue ?? this.form.controls.increaseDecreaseValue.value
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.toast.info('Calculation refreshed.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  resetToDefault(): void {
    this.form.patchValue({ ...PERCENTAGE_DEFAULT_FORM }, { emitEvent: true });
    this.toast.info('Reset to default values.');
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
    this.toast.info('History entry restored.');
  }

  async copyResult(): Promise<void> {
    const value = this.formattedResult();
    if (!value) {
      this.toast.info('No result to copy yet.');
      return;
    }
    await mdCopyText(this.toast, value, 'Result');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatDisplay(value: number, digits: number, round: boolean): string {
    return formatPercentageNumber(value, digits, round);
  }

  getModeLabel(mode: CalculatorMode): string {
    return getPercentageModeLabel(mode);
  }

  readonly trackMode = (_: number, mode: ModeDefinition): CalculatorMode => mode.id;
  readonly trackPreset = (_: number, preset: PresetDefinition): string => preset.label;
  readonly trackStep = (_: number, step: string): string => step;
  readonly trackHistory = (_: number, entry: CalculationHistory): string =>
    `${entry.mode}-${entry.timestamp}`;

  private calculate(): void {
    const snapshot = this.readFormValues();
    this.errorMessage.set(null);

    try {
      const calculation = computePercentage({
        mode: snapshot.mode,
        baseValue: toNumber(snapshot.baseValue),
        percentageValue: toNumber(snapshot.percentageValue),
        resultValue: toNumber(snapshot.resultValue),
        increaseDecreaseValue: toNumber(snapshot.increaseDecreaseValue),
        includeDifference: snapshot.includeDifference,
        showSteps: snapshot.showSteps
      });

      this.result.set(calculation);
      this.pushHistory(calculation, snapshot);
    } catch (error) {
      this.errorMessage.set(mapPercentageCalculationError(error));
      this.result.set(null);
    }
  }

  private pushHistory(
    entry: CalculationResult,
    snapshot: PercentageCalculatorFormValues
  ): void {
    const historyEntry: CalculationHistory = {
      ...entry,
      decimalPlaces: snapshot.decimalPlaces,
      roundResult: snapshot.roundResult
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
      return [historyEntry, ...filtered].slice(0, PERCENTAGE_HISTORY_LIMIT);
    });
  }

  private readFormValues(): PercentageCalculatorFormValues {
    return {
      mode: this.form.controls.mode.value,
      baseValue: this.form.controls.baseValue.value ?? '',
      percentageValue: this.form.controls.percentageValue.value ?? '',
      resultValue: this.form.controls.resultValue.value ?? '',
      increaseDecreaseValue: this.form.controls.increaseDecreaseValue.value ?? '',
      decimalPlaces: this.form.controls.decimalPlaces.value,
      showSteps: this.form.controls.showSteps.value,
      roundResult: this.form.controls.roundResult.value,
      includeDifference: this.form.controls.includeDifference.value
    };
  }
}
