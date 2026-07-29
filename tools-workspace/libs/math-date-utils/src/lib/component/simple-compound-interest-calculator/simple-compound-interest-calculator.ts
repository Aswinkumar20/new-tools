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
  INTEREST_COMPOUND_FREQUENCIES,
  INTEREST_CONTRIBUTION_FREQUENCIES,
  INTEREST_DEFAULT_FORM,
  INTEREST_HISTORY_LIMIT,
  INTEREST_MODES,
  INTEREST_PRESETS,
  INTEREST_RELATED_TOOLS
} from '../../constants/simple-compound-interest-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  CompoundingFrequency,
  ContributionFrequency,
  ContributionFrequencyDefinition,
  FrequencyDefinition,
  InterestCalculatorFormGroup,
  InterestCalculatorFormValues,
  InterestHistory,
  InterestMode,
  InterestModeDefinition,
  InterestPreset,
  InterestResult,
  TimelinePoint
} from '../../types/simple-compound-interest-calculator.types';
import {
  buildTimelineSegments,
  calculateInterest,
  formatInterestCurrency,
  formatInterestSummaryText,
  mapInterestCalculationError,
  numberValidator,
  resolveInterestModeLabel,
  resolveInterestSuggestion,
  toNumber
} from '../../utils/simple-compound-interest-calculator.utils';

@Component({
  selector: 'lib-simple-compound-interest-calculator',
  standalone: true,
  templateUrl: './simple-compound-interest-calculator.html',
  styleUrls: ['./simple-compound-interest-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimpleCompoundInterestCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly modes = INTEREST_MODES;
  readonly compoundingFrequencies = INTEREST_COMPOUND_FREQUENCIES;
  readonly contributionFrequencyOptions = INTEREST_CONTRIBUTION_FREQUENCIES;
  readonly presets = INTEREST_PRESETS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = INTEREST_RELATED_TOOLS;

  readonly form: InterestCalculatorFormGroup = this.fb.group({
    mode: this.fb.control<InterestMode>(INTEREST_DEFAULT_FORM.mode, { nonNullable: true }),
    principal: this.fb.control(INTEREST_DEFAULT_FORM.principal, [
      Validators.required,
      numberValidator
    ]),
    rate: this.fb.control(INTEREST_DEFAULT_FORM.rate, [Validators.required, numberValidator]),
    time: this.fb.control(INTEREST_DEFAULT_FORM.time, [Validators.required, numberValidator]),
    frequency: this.fb.control<CompoundingFrequency>(INTEREST_DEFAULT_FORM.frequency, {
      nonNullable: true
    }),
    contributions: this.fb.control(INTEREST_DEFAULT_FORM.contributions, [numberValidator]),
    contributionFrequency: this.fb.control<ContributionFrequency>(
      INTEREST_DEFAULT_FORM.contributionFrequency,
      { nonNullable: true }
    ),
    targetAmount: this.fb.control(INTEREST_DEFAULT_FORM.targetAmount, [numberValidator]),
    includeTimeline: this.fb.control(INTEREST_DEFAULT_FORM.includeTimeline, {
      nonNullable: true
    }),
    includeBreakdown: this.fb.control(INTEREST_DEFAULT_FORM.includeBreakdown, {
      nonNullable: true
    })
  });

  readonly result = signal<InterestResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<InterestHistory[]>([]);
  readonly formSnapshot = signal<InterestCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly timeline = computed(() => this.result()?.timeline ?? []);
  readonly breakdown = computed(() => this.result()?.breakdown ?? null);
  readonly goals = computed(() => this.result()?.goalProgress ?? null);

  readonly timelineSegments = computed(() => buildTimelineSegments(this.timeline()));

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const suggestion = resolveInterestSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      mode: snapshot.mode,
      ratePercent: toNumber(snapshot.rate),
      timeYears: toNumber(snapshot.time),
      contributions: toNumber(snapshot.contributions),
      hasTarget: snapshot.targetAmount.trim().length > 0,
      goalReached: Boolean(current?.goalProgress?.reached),
      principal: toNumber(snapshot.principal)
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

  setMode(mode: InterestMode): void {
    if (mode === this.form.controls.mode.value) {
      return;
    }
    this.form.patchValue({ mode }, { emitEvent: true });
    this.toast.info(`${resolveInterestModeLabel(mode)} mode selected.`);
  }

  applyPreset(preset: InterestPreset): void {
    this.form.patchValue(
      {
        mode: preset.mode,
        principal: preset.principal,
        rate: preset.rate,
        time: preset.time,
        frequency: preset.frequency ?? this.form.controls.frequency.value,
        contributions: preset.contributions ?? this.form.controls.contributions.value,
        contributionFrequency:
          preset.contributionFrequency ?? this.form.controls.contributionFrequency.value,
        targetAmount: preset.targetAmount ?? this.form.controls.targetAmount.value ?? ''
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.toast.info('Interest recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  async copyResult(): Promise<void> {
    const current = this.summary();
    if (!current) {
      return;
    }
    await mdCopyText(this.toast, formatInterestSummaryText(current), 'Result');
  }

  restoreHistory(entry: InterestHistory): void {
    this.form.patchValue(
      {
        mode: entry.mode,
        principal: entry.principal,
        rate: entry.rate,
        time: entry.time,
        frequency: entry.frequency,
        contributions: entry.contributions,
        contributionFrequency: entry.contributionFrequency,
        targetAmount: entry.targetAmount ?? ''
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatCurrency(value: number): string {
    return formatInterestCurrency(value);
  }

  readonly trackMode = (_: number, mode: InterestModeDefinition): InterestMode => mode.id;
  readonly trackFrequency = (_: number, frequency: FrequencyDefinition): CompoundingFrequency =>
    frequency.id;
  readonly trackPreset = (_: number, preset: InterestPreset): string => preset.label;
  readonly trackTimeline = (_: number, point: TimelinePoint): string => point.label;
  readonly trackHistory = (_: number, entry: InterestHistory): string =>
    `${entry.mode}-${entry.principal}-${entry.rate}-${entry.time}`;
  readonly trackFrequencyOption = (
    _: number,
    option: FrequencyDefinition
  ): CompoundingFrequency => option.id;
  readonly trackContributionOption = (
    _: number,
    option: ContributionFrequencyDefinition
  ): ContributionFrequency => option.id;

  private calculate(): void {
    this.errorMessage.set(null);
    const snapshot = this.readFormValues();

    try {
      const interestResult = calculateInterest({
        mode: snapshot.mode,
        principal: toNumber(snapshot.principal),
        rate: toNumber(snapshot.rate) / 100,
        time: toNumber(snapshot.time),
        frequency: snapshot.frequency,
        contributions: toNumber(snapshot.contributions),
        contributionFrequency: snapshot.contributionFrequency,
        targetAmount: snapshot.targetAmount ? toNumber(snapshot.targetAmount) : undefined,
        includeTimeline: snapshot.includeTimeline,
        includeBreakdown: snapshot.includeBreakdown
      });

      this.result.set(interestResult);
      this.pushHistory(interestResult, snapshot);
    } catch (error) {
      this.errorMessage.set(mapInterestCalculationError(error));
      this.result.set(null);
    }
  }

  private pushHistory(result: InterestResult, snapshot: InterestCalculatorFormValues): void {
    const historyEntry: InterestHistory = {
      ...result,
      mode: snapshot.mode,
      principal: snapshot.principal,
      rate: snapshot.rate,
      time: snapshot.time,
      frequency: snapshot.frequency,
      contributions: snapshot.contributions,
      contributionFrequency: snapshot.contributionFrequency,
      targetAmount: snapshot.targetAmount
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) =>
          !(
            item.principal === historyEntry.principal &&
            item.rate === historyEntry.rate &&
            item.time === historyEntry.time &&
            item.mode === historyEntry.mode
          )
      );
      return [historyEntry, ...filtered].slice(0, INTEREST_HISTORY_LIMIT);
    });
  }

  private readFormValues(): InterestCalculatorFormValues {
    return {
      mode: this.form.controls.mode.value,
      principal: this.form.controls.principal.value ?? '',
      rate: this.form.controls.rate.value ?? '',
      time: this.form.controls.time.value ?? '',
      frequency: this.form.controls.frequency.value,
      contributions: this.form.controls.contributions.value ?? '',
      contributionFrequency: this.form.controls.contributionFrequency.value,
      targetAmount: this.form.controls.targetAmount.value ?? '',
      includeTimeline: this.form.controls.includeTimeline.value,
      includeBreakdown: this.form.controls.includeBreakdown.value
    };
  }
}
