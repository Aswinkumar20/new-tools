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
  DATE_DIFF_DEFAULT_FORM,
  DATE_DIFF_HISTORY_LIMIT,
  DATE_DIFF_PRESETS,
  DATE_DIFF_RELATED_TOOLS
} from '../../constants/date-difference-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  Countdown,
  DateDiffHistory,
  DateDiffPreset,
  DateDiffResult,
  DateDifferenceFormGroup,
  DateDifferenceFormValues,
  Milestone,
  TimelineSegmentWithProportion
} from '../../types/date-difference-calculator.types';
import {
  buildDurationSegments,
  calculateDateDifference,
  formatCountdown,
  formatDateDiffResultText,
  mapDateDiffCalculationError,
  parseDateInput,
  prependDateDiffHistory,
  resolveDateDiffSuggestion,
  toISODate
} from '../../utils/date-difference-calculator.utils';

@Component({
  selector: 'lib-date-difference-calculator',
  standalone: true,
  templateUrl: './date-difference-calculator.html',
  styleUrls: ['./date-difference-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateDifferenceCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private readonly subscriptions = new Subscription();

  readonly presets = DATE_DIFF_PRESETS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = DATE_DIFF_RELATED_TOOLS;

  readonly form: DateDifferenceFormGroup = this.fb.group({
    startDate: this.fb.control(DATE_DIFF_DEFAULT_FORM.startDate, [Validators.required]),
    endDate: this.fb.control(DATE_DIFF_DEFAULT_FORM.endDate, [Validators.required]),
    includeTime: this.fb.control(DATE_DIFF_DEFAULT_FORM.includeTime, { nonNullable: true }),
    startTime: this.fb.control(DATE_DIFF_DEFAULT_FORM.startTime),
    endTime: this.fb.control(DATE_DIFF_DEFAULT_FORM.endTime),
    countBusinessDays: this.fb.control(DATE_DIFF_DEFAULT_FORM.countBusinessDays, {
      nonNullable: true
    }),
    includeTimeline: this.fb.control(DATE_DIFF_DEFAULT_FORM.includeTimeline, {
      nonNullable: true
    }),
    includeMilestones: this.fb.control(DATE_DIFF_DEFAULT_FORM.includeMilestones, {
      nonNullable: true
    }),
    includeWeekdayBreakdown: this.fb.control(DATE_DIFF_DEFAULT_FORM.includeWeekdayBreakdown, {
      nonNullable: true
    })
  });

  readonly result = signal<DateDiffResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<DateDiffHistory[]>([]);
  readonly formSnapshot = signal<DateDifferenceFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly milestones = computed(() => this.result()?.milestones ?? []);
  readonly weekdayBreakdown = computed(() => this.result()?.weekdayBreakdown ?? null);

  readonly durationSegments = computed(() => {
    const current = this.result();
    return buildDurationSegments(current?.timeline, current?.summary.totalDays ?? 0);
  });

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const suggestion = resolveDateDiffSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      totalDays: current?.summary.totalDays ?? 0,
      isForward: current?.summary.isForward ?? true,
      includeTime: snapshot.includeTime,
      countBusinessDays: snapshot.countBusinessDays,
      businessDays: current?.summary.businessDays
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    // Match prior one-shot effect: when time is off at init, normalize times to midnight.
    if (!this.form.controls.includeTime.value) {
      this.form.patchValue({ startTime: '00:00', endTime: '00:00' }, { emitEvent: false });
      this.formSnapshot.set(this.readFormValues());
    }

    this.subscriptions.add(
      this.form.valueChanges.subscribe(() => {
        this.formSnapshot.set(this.readFormValues());
      })
    );

    this.subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.recalculateDifference();
      })
    );

    this.recalculateDifference();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyPreset(preset: DateDiffPreset): void {
    this.form.patchValue(
      {
        startDate: preset.startDate,
        endDate: preset.endDate,
        includeTime: preset.includeTime ?? this.form.controls.includeTime.value,
        startTime: preset.startTime ?? this.form.controls.startTime.value ?? '00:00',
        endTime: preset.endTime ?? this.form.controls.endTime.value ?? '00:00',
        countBusinessDays:
          preset.countBusinessDays ?? this.form.controls.countBusinessDays.value,
        includeMilestones: preset.includeMilestones ?? this.form.controls.includeMilestones.value
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.recalculateDifference();
    this.toast.info('Difference recalculated.');
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
    await mdCopyText(this.toast, formatDateDiffResultText(current), 'Result');
  }

  restoreHistory(entry: DateDiffHistory): void {
    this.form.patchValue(
      {
        startDate: entry.startDate,
        endDate: entry.endDate,
        includeTime: entry.includeTime,
        startTime: entry.startTime,
        endTime: entry.endTime,
        countBusinessDays: entry.countBusinessDays,
        includeTimeline: entry.includeTimeline,
        includeMilestones: entry.includeMilestones,
        includeWeekdayBreakdown: entry.includeWeekdayBreakdown
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatCountdownLabel(value: Countdown | undefined): string {
    return formatCountdown(value);
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }

  readonly trackPreset = (_: number, preset: DateDiffPreset) => preset.label;
  readonly trackTimeline = (_: number, segment: TimelineSegmentWithProportion) => segment.label;
  readonly trackMilestone = (_: number, milestone: Milestone) => milestone.label;
  readonly trackHistory = (_: number, entry: DateDiffHistory) =>
    `${entry.startDate}-${entry.endDate}-${entry.includeTime}`;

  private readFormValues(): DateDifferenceFormValues {
    const raw = this.form.getRawValue();
    return {
      startDate: raw.startDate ?? DATE_DIFF_DEFAULT_FORM.startDate,
      endDate: raw.endDate ?? DATE_DIFF_DEFAULT_FORM.endDate,
      includeTime: raw.includeTime,
      startTime: raw.startTime ?? '00:00',
      endTime: raw.endTime ?? '00:00',
      countBusinessDays: raw.countBusinessDays,
      includeTimeline: raw.includeTimeline,
      includeMilestones: raw.includeMilestones,
      includeWeekdayBreakdown: raw.includeWeekdayBreakdown
    };
  }

  private recalculateDifference(): void {
    this.errorMessage.set(null);
    const snapshot = this.readFormValues();
    const rawEnd = snapshot.endDate.trim() || 'today';

    try {
      const startDate = parseDateInput(
        snapshot.startDate,
        snapshot.startTime,
        snapshot.includeTime,
        'Start date'
      );
      const endDate =
        rawEnd === 'today'
          ? new Date()
          : parseDateInput(rawEnd, snapshot.endTime, snapshot.includeTime, 'End date');

      const nextResult = calculateDateDifference({
        startDate,
        endDate,
        includeTime: snapshot.includeTime,
        includeTimeline: snapshot.includeTimeline,
        includeMilestones: snapshot.includeMilestones,
        countBusinessDays: snapshot.countBusinessDays,
        includeWeekdayBreakdown: snapshot.includeWeekdayBreakdown
      });

      this.result.set(nextResult);
      this.history.update((current) =>
        prependDateDiffHistory(
          current,
          {
            ...nextResult,
            startDate: toISODate(startDate),
            endDate: rawEnd.trim() === 'today' ? 'today' : toISODate(endDate),
            startTime: snapshot.includeTime ? snapshot.startTime : '00:00',
            endTime: snapshot.includeTime ? snapshot.endTime : '00:00',
            includeTime: snapshot.includeTime,
            includeTimeline: snapshot.includeTimeline,
            includeMilestones: snapshot.includeMilestones,
            countBusinessDays: snapshot.countBusinessDays,
            includeWeekdayBreakdown: snapshot.includeWeekdayBreakdown
          },
          DATE_DIFF_HISTORY_LIMIT
        )
      );
    } catch (error) {
      this.errorMessage.set(mapDateDiffCalculationError(error));
      this.result.set(null);
    }
  }
}
