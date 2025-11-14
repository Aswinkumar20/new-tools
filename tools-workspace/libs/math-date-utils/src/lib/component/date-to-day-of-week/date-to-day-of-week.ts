import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Navigation } from '@tools-workspace/features-home';

type DatePreset = 'today' | 'tomorrow' | 'yesterday';

interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

interface LocaleOption {
  value: string;
  label: string;
}

interface DayLookup {
  isoDate: string;
  dayName: string;
  timezone: string;
  locale: string;
  relativeLabel: string;
  computedAt: number;
}

interface DayDetails {
  isoDate: string;
  displayDate: string;
  dayName: string;
  shortDayName: string;
  isWeekend: boolean;
  isoWeekday: number;
  weekNumber: number;
  dayOfYear: number;
  totalDaysInYear: number;
  timezone: string;
  locale: string;
  relativeLabel: string;
  daysFromToday: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  seasonLabel: string;
  lunarApproximation: string;
}

type DateLookupForm = FormGroup<{
  inputDate: FormControl<string>;
  timezone: FormControl<string>;
  locale: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

const DEFAULT_LOCALE = navigator.language || 'en-US';
const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: DEFAULT_TZ, label: `Local · ${DEFAULT_TZ}`, region: 'Local' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', region: 'Global' },
  { value: 'America/New_York', label: 'New York (ET)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)', region: 'Americas' },
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Oceania' }
];

const LOCALE_OPTIONS: LocaleOption[] = [
  { value: DEFAULT_LOCALE, label: `System default (${DEFAULT_LOCALE})` },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' }
];

@Component({
  selector: 'lib-date-to-day-of-week',
  standalone: true,
  templateUrl: './date-to-day-of-week.html',
  styleUrls: ['./date-to-day-of-week.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateToDayOfWeekComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly timezones = TIMEZONE_OPTIONS;
  readonly locales = LOCALE_OPTIONS;

  readonly form: DateLookupForm = this.fb.group({
    inputDate: this.fb.control(formatDateInput(new Date()), {
      validators: [Validators.required, isoDateValidator],
      nonNullable: true
    }),
    timezone: this.fb.control(DEFAULT_TZ, { validators: [Validators.required], nonNullable: true }),
    locale: this.fb.control(DEFAULT_LOCALE, { validators: [Validators.required], nonNullable: true }),
    rememberHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly details: WritableSignal<DayDetails | null> = signal(null);
  readonly insights = signal<string[]>([]);
  readonly history: WritableSignal<DayLookup[]> = signal([]);
  readonly upcomingWeekdays = computed(() => buildUpcomingWeekdays(this.form.controls.inputDate.value, this.form.controls.timezone.value));

  readonly hasHistory = computed(() => this.history().length > 0);

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculate());

    this.calculate();
  }

  presetDate(preset: DatePreset): void {
    const today = new Date();
    switch (preset) {
      case 'today':
        this.form.patchValue({ inputDate: formatDateInput(today) });
        break;
      case 'tomorrow':
        this.form.patchValue({ inputDate: formatDateInput(addDays(today, 1)) });
        break;
      case 'yesterday':
        this.form.patchValue({ inputDate: formatDateInput(addDays(today, -1)) });
        break;
    }
  }

  jumpToWeekday(weekdayIndex: number): void {
    const target = getNextWeekday(new Date(), weekdayIndex);
    this.form.patchValue({ inputDate: formatDateInput(target) });
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
  }

  clearHistory(): void {
    this.history.set([]);
  }

  private calculate(): void {
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
      this.history.update((current) => {
        const next = [{ isoDate: result.isoDate, dayName: result.dayName, timezone, locale, relativeLabel: result.relativeLabel, computedAt: Date.now() }, ...current.filter((item) => item.isoDate !== result.isoDate || item.timezone !== timezone || item.locale !== locale)];
        return next.slice(0, 8);
      });
    }
  }
}

function isoDateValidator(control: import('@angular/forms').AbstractControl) {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? null : { isoDate: true };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, offset: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + offset);
  return clone;
}

function getNextWeekday(base: Date, targetWeekday: number): Date {
  const date = new Date(base);
  const day = date.getDay();
  const delta = (targetWeekday + 7 - day) % 7 || 7;
  return addDays(date, delta);
}

function buildDayDetails(isoDate: string, timezone: string, locale: string): DayDetails {
  const date = new Date(`${isoDate}T00:00:00`);

  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: timezone });
  const weekdayShortFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: timezone });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: timezone });

  const dayName = weekdayFormatter.format(date);
  const shortDayName = weekdayShortFormatter.format(date);
  const displayDate = dateFormatter.format(date);

  const isoWeekday = getISOWeekday(date, timezone);
  const weekNumber = getISOWeekNumber(date, timezone);
  const dayOfYear = getDayOfYear(date, timezone);
  const totalDaysInYear = isLeapYear(date.getFullYear()) ? 366 : 365;

  const today = startOfDay(new Date());
  const targetDay = startOfDay(new Date(`${isoDate}T00:00:00`));
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isoDate,
    displayDate,
    dayName,
    shortDayName,
    isWeekend: isoWeekday === 6 || isoWeekday === 7,
    isoWeekday,
    weekNumber,
    dayOfYear,
    totalDaysInYear,
    timezone,
    locale,
    relativeLabel: buildRelativeLabel(diffDays),
    daysFromToday: diffDays,
    isToday: diffDays === 0,
    isPast: diffDays < 0,
    isFuture: diffDays > 0,
    seasonLabel: describeSeason(date, timezone),
    lunarApproximation: approximateMoonPhase(date)
  };
}

function buildInsights(details: DayDetails): string[] {
  const messages: string[] = [];
  messages.push(`${details.displayDate} falls on a ${details.dayName}.`);
  messages.push(`ISO week ${details.weekNumber}, day ${details.isoWeekday} · Day ${details.dayOfYear} of ${details.totalDaysInYear}.`);

  if (details.isWeekend) {
    messages.push('This date lands on a weekend.');
  } else {
    messages.push('This date lands on a weekday.');
  }

  if (details.daysFromToday === 0) {
    messages.push('That is today!');
  } else if (details.daysFromToday > 0) {
    messages.push(`${details.daysFromToday} day${details.daysFromToday === 1 ? '' : 's'} from now.`);
  } else {
    const daysAgo = Math.abs(details.daysFromToday);
    messages.push(`${daysAgo} day${daysAgo === 1 ? '' : 's'} ago.`);
  }

  messages.push(details.seasonLabel);
  messages.push(details.lunarApproximation);
  return messages;
}

function buildRelativeLabel(daysFromToday: number): string {
  if (daysFromToday === 0) {
    return 'Today';
  }
  if (daysFromToday === 1) {
    return 'Tomorrow';
  }
  if (daysFromToday === -1) {
    return 'Yesterday';
  }
  if (daysFromToday > 0) {
    return `In ${daysFromToday} days`;
  }
  return `${Math.abs(daysFromToday)} days ago`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getISOWeekday(date: Date, timezone: string): number {
  const zonedDate = new Date(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date));
  const day = zonedDate.getDay();
  return day === 0 ? 7 : day;
}

function getISOWeekNumber(date: Date, timezone: string): number {
  const zoned = toUTCDateInTimezone(date, timezone);
  const target = new Date(zoned.valueOf());
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

function getDayOfYear(date: Date, timezone: string): number {
  const zoned = toUTCDateInTimezone(date, timezone);
  const start = Date.UTC(zoned.getUTCFullYear(), 0, 0);
  const diff = zoned.getTime() - start;
  return Math.floor(diff / 86400000);
}

function toUTCDateInTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, item) => {
    if (item.type !== 'literal') {
      acc[item.type] = item.value;
    }
    return acc;
  }, {});

  return new Date(
    Date.UTC(
      Number.parseInt(parts['year'] ?? '0', 10),
      Number.parseInt(parts['month'] ?? '1', 10) - 1,
      Number.parseInt(parts['day'] ?? '1', 10),
      Number.parseInt(parts['hour'] ?? '0', 10),
      Number.parseInt(parts['minute'] ?? '0', 10),
      Number.parseInt(parts['second'] ?? '0', 10)
    )
  );
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function describeSeason(date: Date, timezone: string): string {
  const zoned = toUTCDateInTimezone(date, timezone);
  const month = zoned.getUTCMonth() + 1;
  const day = zoned.getUTCDate();
  const inRange = (start: [number, number], end: [number, number]): boolean => {
    const dateValue = month * 100 + day;
    const startValue = start[0] * 100 + start[1];
    const endValue = end[0] * 100 + end[1];
    if (startValue <= endValue) {
      return dateValue >= startValue && dateValue <= endValue;
    }
    return dateValue >= startValue || dateValue <= endValue;
  };

  if (inRange([3, 20], [6, 20])) {
    return 'Northern hemisphere: Spring · Southern hemisphere: Autumn';
  }
  if (inRange([6, 21], [9, 21])) {
    return 'Northern hemisphere: Summer · Southern hemisphere: Winter';
  }
  if (inRange([9, 22], [12, 20])) {
    return 'Northern hemisphere: Autumn · Southern hemisphere: Spring';
  }
  return 'Northern hemisphere: Winter · Southern hemisphere: Summer';
}

function approximateMoonPhase(date: Date): string {
  // Simple approximation using known new moon date (Jan 6, 2000) as baseline.
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
  const diff = date.getTime() - knownNewMoon.getTime();
  const lunations = diff / (1000 * 60 * 60 * 24 * 29.530588853);
  const phase = lunations - Math.floor(lunations);

  if (phase < 0.03 || phase > 0.97) {
    return 'Approximate moon phase: New Moon';
  }
  if (phase < 0.22) {
    return 'Approximate moon phase: Waxing Crescent';
  }
  if (phase < 0.28) {
    return 'Approximate moon phase: First Quarter';
  }
  if (phase < 0.47) {
    return 'Approximate moon phase: Waxing Gibbous';
  }
  if (phase < 0.53) {
    return 'Approximate moon phase: Full Moon';
  }
  if (phase < 0.72) {
    return 'Approximate moon phase: Waning Gibbous';
  }
  if (phase < 0.78) {
    return 'Approximate moon phase: Last Quarter';
  }
  return 'Approximate moon phase: Waning Crescent';
}

function buildUpcomingWeekdays(isoDate: string, timezone: string): Array<{ label: string; date: string }> {
  const baseDate = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  const results: Array<{ label: string; date: string }> = [];
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  for (let i = 1; i <= 3; i += 1) {
    const candidate = addDays(baseDate, i);
    const iso = formatDateInput(candidate);
    const label = formatter.format(candidate);
    results.push({ label, date: iso });
  }

  return results;
}
