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
  DATE_DOW_DEFAULT_LOCALE,
  DATE_DOW_DEFAULT_TZ,
  DATE_DOW_HISTORY_LIMIT,
  DATE_DOW_LOCALE_OPTIONS,
  DATE_DOW_RELATED_TOOLS,
  DATE_DOW_TIMEZONE_OPTIONS
} from '../../constants/date-to-day-of-week.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  DateLookupForm,
  DateLookupFormValues,
  DatePreset,
  DayDetails,
  DayLookup
} from '../../types/date-to-day-of-week.types';
import {
  buildDayDetails,
  buildInsights,
  buildUpcomingWeekdays,
  formatDateInput,
  formatDayDetailsText,
  getNextWeekday,
  isoDateValidator,
  prependDayLookupHistory,
  resolveDayOfWeekSuggestion,
  resolvePresetDate
} from '../../utils/date-to-day-of-week.utils';

@Component({
  selector: 'lib-date-to-day-of-week',
  standalone: true,
  templateUrl: './date-to-day-of-week.html',
  styleUrls: ['./date-to-day-of-week.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateToDayOfWeekComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly timezones = DATE_DOW_TIMEZONE_OPTIONS;
  readonly locales = DATE_DOW_LOCALE_OPTIONS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = DATE_DOW_RELATED_TOOLS;

  readonly form: DateLookupForm = this.fb.group({
    inputDate: this.fb.control(formatDateInput(new Date()), {
      validators: [Validators.required, isoDateValidator],
      nonNullable: true
    }),
    timezone: this.fb.control(DATE_DOW_DEFAULT_TZ, {
      validators: [Validators.required],
      nonNullable: true
    }),
    locale: this.fb.control(DATE_DOW_DEFAULT_LOCALE, {
      validators: [Validators.required],
      nonNullable: true
    }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly details = signal<DayDetails | null>(null);
  readonly insights = signal<string[]>([]);
  readonly history = signal<DayLookup[]>([]);
  readonly formSnapshot = signal<DateLookupFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly upcomingWeekdays = computed(() => {
    const snapshot = this.formSnapshot();
    return buildUpcomingWeekdays(snapshot.inputDate, snapshot.timezone);
  });

  readonly hasHistory = computed(() => this.history().length > 0);

  readonly primarySuggestion = computed(() => {
    const current = this.details();
    const suggestion = resolveDayOfWeekSuggestion({
      hasResult: current !== null,
      hasError: this.form.invalid && this.form.controls.inputDate.touched,
      isWeekend: current?.isWeekend ?? false,
      isToday: current?.isToday ?? false,
      daysFromToday: current?.daysFromToday ?? 0,
      isoWeekday: current?.isoWeekday ?? 0
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(120), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.recalculateDayLookup();
    });

    this.recalculateDayLookup();
  }

  presetDate(preset: DatePreset): void {
    this.form.patchValue({ inputDate: resolvePresetDate(preset) });
    this.toast.info(
      preset === 'today'
        ? 'Jumped to today.'
        : preset === 'tomorrow'
          ? 'Jumped to tomorrow.'
          : 'Jumped to yesterday.'
    );
  }

  jumpToWeekday(weekdayIndex: number): void {
    const target = getNextWeekday(new Date(), weekdayIndex);
    this.form.patchValue({ inputDate: formatDateInput(target) });
    this.toast.info('Jumped to the next matching weekday.');
  }

  selectUpcomingDate(isoDate: string): void {
    this.form.patchValue({ inputDate: isoDate });
  }

  applyHistory(entry: DayLookup): void {
    this.form.patchValue(
      {
        inputDate: entry.isoDate,
        timezone: entry.timezone,
        locale: entry.locale
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  async copyResult(): Promise<void> {
    const current = this.details();
    if (!current) {
      return;
    }
    await mdCopyText(this.toast, formatDayDetailsText(current, this.insights()), 'Result');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): DateLookupFormValues {
    const raw = this.form.getRawValue();
    return {
      inputDate: raw.inputDate,
      timezone: raw.timezone,
      locale: raw.locale,
      rememberHistory: raw.rememberHistory
    };
  }

  private recalculateDayLookup(): void {
    if (this.form.invalid) {
      this.details.set(null);
      this.insights.set([]);
      return;
    }

    const { inputDate, timezone, locale, rememberHistory } = this.form.getRawValue();
    if (!inputDate || !timezone || !locale) {
      this.details.set(null);
      this.insights.set([]);
      return;
    }

    const result = buildDayDetails(inputDate, timezone, locale);
    this.details.set(result);
    this.insights.set(buildInsights(result));

    if (rememberHistory) {
      this.history.update((current) =>
        prependDayLookupHistory(
          current,
          {
            isoDate: result.isoDate,
            dayName: result.dayName,
            timezone,
            locale,
            relativeLabel: result.relativeLabel,
            computedAt: Date.now()
          },
          DATE_DOW_HISTORY_LIMIT
        )
      );
    }
  }
}
