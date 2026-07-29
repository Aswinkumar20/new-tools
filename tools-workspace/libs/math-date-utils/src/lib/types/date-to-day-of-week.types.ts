import type { FormControl, FormGroup } from '@angular/forms';

export type DatePreset = 'today' | 'tomorrow' | 'yesterday';

export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

export interface LocaleOption {
  value: string;
  label: string;
}

export interface DayLookup {
  isoDate: string;
  dayName: string;
  timezone: string;
  locale: string;
  relativeLabel: string;
  computedAt: number;
}

export interface DayDetails {
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

export interface UpcomingWeekday {
  label: string;
  date: string;
}

export type DateLookupForm = FormGroup<{
  inputDate: FormControl<string>;
  timezone: FormControl<string>;
  locale: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

export interface DateLookupFormValues {
  inputDate: string;
  timezone: string;
  locale: string;
  rememberHistory: boolean;
}

export interface DayOfWeekSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  isWeekend: boolean;
  isToday: boolean;
  daysFromToday: number;
  isoWeekday: number;
}
