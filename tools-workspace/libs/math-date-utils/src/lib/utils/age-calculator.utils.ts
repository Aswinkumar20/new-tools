import {
  AGE_INFANT_DAYS_THRESHOLD,
  AGE_MILESTONE_OFFSETS,
  AGE_SENIOR_YEARS_THRESHOLD,
  CHINESE_ZODIAC_ANIMALS,
  MS_IN_DAY,
  WESTERN_ZODIAC_SIGNS
} from '../constants/age-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  AgeCalculatorOptions,
  AgeHistory,
  AgeResult,
  AgeSuggestionContext,
  AgeSummary,
  AgeUnits,
  CountdownBreakdown,
  MilestoneItem,
  TimelineItem,
  TimelineSegment,
  ZodiacInfo
} from '../types/age-calculator.types';

export function calculateAge(options: AgeCalculatorOptions): AgeResult {
  const { birthDate, comparisonDate, includeTime, includeMilestones, includeZodiac, showTimeline } =
    options;

  if (comparisonDate.getTime() < birthDate.getTime()) {
    throw new Error('Comparison date cannot be earlier than the birth date.');
  }

  const diffMilliseconds = comparisonDate.getTime() - birthDate.getTime();
  const totalDays = Math.floor(diffMilliseconds / MS_IN_DAY);
  const totalHours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
  const totalMinutes = Math.floor(diffMilliseconds / (1000 * 60));
  const totalSeconds = Math.floor(diffMilliseconds / 1000);

  const { years, months, days } = computeYMD(birthDate, comparisonDate);
  const summary: AgeSummary = {
    years,
    months,
    days,
    nextBirthday: formatDate(computeNextBirthday(birthDate, comparisonDate)),
    nextBirthdayCountdown: computeCountdown(comparisonDate, computeNextBirthday(birthDate, comparisonDate)),
    exactAge: formatExactAge({ years, months, days }),
    ageInUnits: {
      weeks: Math.floor(totalDays / 7),
      days: totalDays,
      hours: totalHours,
      minutes: totalMinutes,
      seconds: totalSeconds
    }
  };

  if (includeTime) {
    summary.hours = totalHours % 24;
    summary.minutes = totalMinutes % 60;
  }

  const timeline = showTimeline ? buildTimeline(summary.ageInUnits, years) : undefined;
  const milestones = includeMilestones ? buildMilestones(birthDate, comparisonDate) : undefined;
  const zodiac = includeZodiac ? buildZodiac(birthDate) : undefined;

  return { summary, timeline, milestones, zodiac, totalDays };
}

export function parseDateString(raw: string, time: string, includeTime: boolean): Date {
  if (!raw.trim()) {
    throw new Error('Date cannot be empty.');
  }

  if (raw === 'today') {
    return new Date();
  }

  const [hours, minutes] = includeTime ? parseTime(time) : [0, 0];
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function parseTime(value: string): [number, number] {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return [0, 0];
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return [Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0];
}

export function computeYMD(start: Date, end: Date): { years: number; months: number; days: number } {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    const temp = new Date(end.getFullYear(), end.getMonth(), 0);
    days += temp.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return { years, months, days };
}

export function computeNextBirthday(birthDate: Date, referenceDate: Date): Date {
  const next = new Date(referenceDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < referenceDate) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

export function computeCountdown(from: Date, to: Date): CountdownBreakdown {
  const diff = to.getTime() - from.getTime();
  const totalDays = Math.floor(diff / MS_IN_DAY);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = Math.floor((diff % MS_IN_DAY) / (1000 * 60 * 60));
  return { months, days, hours };
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatExactAge(parts: { years: number; months: number; days: number }): string {
  const segments: string[] = [];
  if (parts.years > 0) {
    segments.push(`${parts.years} year${parts.years === 1 ? '' : 's'}`);
  }
  if (parts.months > 0) {
    segments.push(`${parts.months} month${parts.months === 1 ? '' : 's'}`);
  }
  if (parts.days > 0) {
    segments.push(`${parts.days} day${parts.days === 1 ? '' : 's'}`);
  }
  return segments.length ? segments.join(', ') : '0 days';
}

export function buildTimeline(units: AgeUnits, years: number): TimelineItem[] {
  return [
    {
      label: 'Years lived',
      description: `Full years since birth (${years})`,
      days: years * 365
    },
    {
      label: 'Weeks lived',
      description: 'Total weeks experienced',
      days: Math.round(units.weeks * 7)
    },
    {
      label: 'Days lived',
      description: 'Exact total days',
      days: units.days
    }
  ];
}

export function buildMilestones(birthDate: Date, reference: Date): MilestoneItem[] {
  return AGE_MILESTONE_OFFSETS.map((milestone) => {
    const target = new Date(birthDate.getTime() + milestone.offsetDays * MS_IN_DAY);
    if (target <= reference) {
      return null;
    }

    return {
      label: milestone.label,
      description: `Happens on ${formatDate(target)}`,
      targetDate: formatDate(target),
      remaining: computeCountdown(reference, target)
    };
  }).filter((item): item is MilestoneItem => item !== null);
}

export function buildZodiac(birthDate: Date): ZodiacInfo {
  return {
    western: determineWesternZodiac(birthDate),
    chinese: determineChineseZodiac(birthDate)
  };
}

export function determineWesternZodiac(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  for (let i = 1; i < WESTERN_ZODIAC_SIGNS.length; i++) {
    const [startMonth, startDay] = WESTERN_ZODIAC_SIGNS[i].start;
    if (month < startMonth || (month === startMonth && day < startDay)) {
      return WESTERN_ZODIAC_SIGNS[i - 1].sign;
    }
  }

  return 'Capricorn';
}

export function determineChineseZodiac(date: Date): string {
  const year = date.getFullYear();
  return CHINESE_ZODIAC_ANIMALS[(year - 4) % 12];
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function buildTimelineSegments(
  timeline: TimelineItem[] | undefined,
  totalDays: number | undefined
): TimelineSegment[] {
  if (!timeline || !totalDays) {
    return [];
  }

  return timeline.map((item) => ({
    ...item,
    proportion: Math.min(100, Math.max(0.5, (item.days / totalDays) * 100))
  }));
}

export function formatAgeResultText(result: AgeResult): string {
  const summary = result.summary;
  const lines = [
    `Age: ${summary.exactAge}`,
    `Years: ${summary.years}, Months: ${summary.months}, Days: ${summary.days}`,
    `Next birthday: ${summary.nextBirthday}`,
    `Countdown: ${summary.nextBirthdayCountdown.months} months, ${summary.nextBirthdayCountdown.days} days`
  ];

  if (result.zodiac) {
    lines.push(`Western: ${result.zodiac.western}`, `Chinese: ${result.zodiac.chinese}`);
  }

  return lines.join('\n');
}

export function prependAgeHistory(
  current: AgeHistory[],
  entry: AgeHistory,
  limit: number
): AgeHistory[] {
  const filtered = current.filter(
    (item) =>
      !(
        item.birthDate === entry.birthDate &&
        item.comparisonDate === entry.comparisonDate &&
        item.anchor === entry.anchor
      )
  );
  return [{ ...entry }, ...filtered].slice(0, limit);
}

export function resolveAgeSuggestion(context: AgeSuggestionContext): MdToolSuggestion | null {
  const { hasResult, hasError, anchor, includeZodiac, totalDays, years } = context;

  if (hasError) {
    return {
      id: 'ac-date-order',
      title: 'Need a clearer date span?',
      reason:
        'Age requires the comparison date to be on or after the birth date. Date Difference Calculator can also help validate two dates.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult && includeZodiac) {
    return {
      id: 'ac-zodiac',
      title: 'Want a deeper zodiac reading?',
      reason:
        'Zodiac Finder expands Western and Chinese signs beyond the quick summary shown here.',
      actionLabel: 'Open Zodiac Finder',
      path: '/math-date-utils/zodiac-finder'
    };
  }

  if (hasResult && totalDays < AGE_INFANT_DAYS_THRESHOLD) {
    return {
      id: 'ac-infant',
      title: 'Tracking early days precisely?',
      reason:
        'For infants, day-level and business-day spans are often more useful. Date Difference Calculator focuses on exact intervals.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult && (anchor === 'specific' || years >= AGE_SENIOR_YEARS_THRESHOLD)) {
    return {
      id: 'ac-long-span',
      title: 'Comparing two calendar points?',
      reason:
        'Date Difference Calculator breaks long ranges into years, months, business days, and weekday patterns.',
      actionLabel: 'Open Date Difference',
      path: '/math-date-utils/date-difference-calculator'
    };
  }

  if (hasResult) {
    return {
      id: 'ac-weekday',
      title: 'Curious which weekday that was?',
      reason:
        'Date to Day of Week shows the weekday for birthdays, milestones, or any comparison date.',
      actionLabel: 'Open Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  return {
    id: 'ac-start',
    title: 'Start with a birth date',
    reason:
      'Enter a date of birth to see exact age, milestones, and zodiac. Related date tools can refine planning afterward.',
    actionLabel: 'Open Date Difference',
    path: '/math-date-utils/date-difference-calculator'
  };
}

export function mapAgeCalculationError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to calculate age.';
}
