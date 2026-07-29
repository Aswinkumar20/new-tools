import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  DATE_DOW_HISTORY_LIMIT,
  DATE_DOW_KNOWN_NEW_MOON_UTC,
  DATE_DOW_LONG_RANGE_DAYS,
  DATE_DOW_SYNODIC_MONTH_DAYS
} from '../constants/date-to-day-of-week.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  DatePreset,
  DayDetails,
  DayLookup,
  DayOfWeekSuggestionContext,
  UpcomingWeekday
} from '../types/date-to-day-of-week.types';

export function isoDateValidator(control: AbstractControl): ValidationErrors | null {
  const raw = `${control.value ?? ''}`.trim();
  if (!raw) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? null : { isoDate: true };
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, offset: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + offset);
  return clone;
}

export function resolvePresetDate(preset: DatePreset, today: Date = new Date()): string {
  switch (preset) {
    case 'today':
      return formatDateInput(today);
    case 'tomorrow':
      return formatDateInput(addDays(today, 1));
    case 'yesterday':
      return formatDateInput(addDays(today, -1));
  }
}

export function getNextWeekday(base: Date, targetWeekday: number): Date {
  const date = new Date(base);
  const day = date.getDay();
  const delta = (targetWeekday + 7 - day) % 7 || 7;
  return addDays(date, delta);
}

export function buildDayDetails(isoDate: string, timezone: string, locale: string): DayDetails {
  const date = new Date(`${isoDate}T00:00:00`);

  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    timeZone: timezone
  });
  const weekdayShortFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: timezone
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: timezone
  });

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

export function buildInsights(details: DayDetails): string[] {
  const messages: string[] = [];
  messages.push(`${details.displayDate} falls on a ${details.dayName}.`);
  messages.push(
    `ISO week ${details.weekNumber}, day ${details.isoWeekday} · Day ${details.dayOfYear} of ${details.totalDaysInYear}.`
  );

  if (details.isWeekend) {
    messages.push('This date lands on a weekend.');
  } else {
    messages.push('This date lands on a weekday.');
  }

  if (details.daysFromToday === 0) {
    messages.push('That is today!');
  } else if (details.daysFromToday > 0) {
    messages.push(
      `${details.daysFromToday} day${details.daysFromToday === 1 ? '' : 's'} from now.`
    );
  } else {
    const daysAgo = Math.abs(details.daysFromToday);
    messages.push(`${daysAgo} day${daysAgo === 1 ? '' : 's'} ago.`);
  }

  messages.push(details.seasonLabel);
  messages.push(details.lunarApproximation);
  return messages;
}

export function buildRelativeLabel(daysFromToday: number): string {
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

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getISOWeekday(date: Date, timezone: string): number {
  const zonedDate = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  );
  const day = zonedDate.getDay();
  return day === 0 ? 7 : day;
}

export function getISOWeekNumber(date: Date, timezone: string): number {
  const zoned = toUTCDateInTimezone(date, timezone);
  const target = new Date(zoned.valueOf());
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getDayOfYear(date: Date, timezone: string): number {
  const zoned = toUTCDateInTimezone(date, timezone);
  const start = Date.UTC(zoned.getUTCFullYear(), 0, 0);
  const diff = zoned.getTime() - start;
  return Math.floor(diff / 86400000);
}

export function toUTCDateInTimezone(date: Date, timezone: string): Date {
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

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function describeSeason(date: Date, timezone: string): string {
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

export function approximateMoonPhase(date: Date): string {
  const knownNewMoon = new Date(DATE_DOW_KNOWN_NEW_MOON_UTC);
  const diff = date.getTime() - knownNewMoon.getTime();
  const lunations = diff / (1000 * 60 * 60 * 24 * DATE_DOW_SYNODIC_MONTH_DAYS);
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

export function buildUpcomingWeekdays(
  isoDate: string,
  _timezone: string
): UpcomingWeekday[] {
  const baseDate = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  const results: UpcomingWeekday[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  for (let i = 1; i <= 3; i += 1) {
    const candidate = addDays(baseDate, i);
    results.push({
      label: formatter.format(candidate),
      date: formatDateInput(candidate)
    });
  }

  return results;
}

export function formatDayDetailsText(details: DayDetails, insights: string[]): string {
  return [
    `${details.displayDate}: ${details.dayName}`,
    details.relativeLabel,
    `Week ${details.weekNumber}, day ${details.isoWeekday} of ISO week`,
    `Day ${details.dayOfYear} of ${details.totalDaysInYear}`,
    `Season: ${details.seasonLabel}`,
    ...insights
  ].join('\n');
}

export function prependDayLookupHistory(
  current: DayLookup[],
  entry: DayLookup,
  limit: number = DATE_DOW_HISTORY_LIMIT
): DayLookup[] {
  const filtered = current.filter(
    (item) =>
      !(
        item.isoDate === entry.isoDate &&
        item.timezone === entry.timezone &&
        item.locale === entry.locale
      )
  );
  return [entry, ...filtered].slice(0, limit);
}

export function resolveDayOfWeekSuggestion(
  context: DayOfWeekSuggestionContext
): MdToolSuggestion | null {
  const { hasResult, hasError, isWeekend, isToday, daysFromToday } = context;

  if (hasError) {
    return {
      id: 'dt-invalid-date',
      title: 'Use a YYYY-MM-DD date',
      reason:
        'The date field expects an ISO calendar date. Date Difference Calculator can also validate spans once the date is fixed.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult && isToday) {
    return {
      id: 'dt-today',
      title: 'Planning from today?',
      reason:
        'Date Difference Calculator measures how far another date sits from today with business-day options.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult && isWeekend) {
    return {
      id: 'dt-weekend',
      title: 'Weekend date detected',
      reason:
        'If you are scheduling work around this date, Date Difference Calculator can count business days between endpoints.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult && Math.abs(daysFromToday) >= DATE_DOW_LONG_RANGE_DAYS) {
    return {
      id: 'dt-long-range',
      title: 'Date is a year or more away',
      reason:
        'Long-range dates often pair with Age Calculator when the date is a birth date, or Zodiac Finder for sign insights.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  if (hasResult && daysFromToday < 0) {
    return {
      id: 'dt-past',
      title: 'Looking up a past date?',
      reason:
        'Zodiac Finder expands Western and Chinese signs for birth or event dates in history.',
      actionLabel: 'Open Zodiac Finder',
      path: '/math-date-utils/zodiac-finder'
    };
  }

  if (hasResult) {
    return {
      id: 'dt-timezone',
      title: 'Need the local wall time too?',
      reason:
        'Timezone Converter pairs well once you know the weekday and want meeting times across zones.',
      actionLabel: 'Open Timezone Converter',
      path: '/fun-tools/timezone-converter'
    };
  }

  return {
    id: 'dt-start',
    title: 'Pick a calendar date',
    reason:
      'Choose a date to see weekday, ISO week, season, and lunar hints. Related date tools help with spans and ages.',
    actionLabel: 'Open Date Difference',
    path: '/math-date-utils/date-difference-calculator'
  };
}
