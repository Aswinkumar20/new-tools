import {
  DATE_DIFF_HISTORY_LIMIT,
  DATE_DIFF_LONG_SPAN_DAYS,
  DATE_DIFF_MILESTONE_OFFSETS,
  MS_IN_DAY
} from '../constants/date-difference-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  Countdown,
  DateDiffCalculatorOptions,
  DateDiffHistory,
  DateDiffResult,
  DateDiffSuggestionContext,
  DateDiffSummary,
  Milestone,
  TimelineSegment,
  TimelineSegmentWithProportion,
  WeekdayBreakdown
} from '../types/date-difference-calculator.types';

export function calculateDateDifference(options: DateDiffCalculatorOptions): DateDiffResult {
  const {
    startDate,
    endDate,
    includeTime,
    includeTimeline,
    includeMilestones,
    countBusinessDays,
    includeWeekdayBreakdown
  } = options;

  const direction = endDate.getTime() >= startDate.getTime();
  const earlier = direction ? startDate : endDate;
  const later = direction ? endDate : startDate;

  const diffMs = later.getTime() - earlier.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalDays = Math.floor(diffMs / MS_IN_DAY);

  const diffParts = computeDifferenceParts(earlier, later);
  const businessDays = countBusinessDays ? computeBusinessDays(earlier, later) : undefined;
  const weekdayBreakdown = includeWeekdayBreakdown
    ? computeWeekdayBreakdown(earlier, later)
    : undefined;

  const summary: DateDiffSummary = {
    isForward: direction,
    startDateLabel: formatDate(earlier),
    endDateLabel: formatDate(later),
    exactSpan: formatExactSpan(diffParts),
    totalYears: diffParts.years,
    totalMonths: diffParts.months,
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    businessDays
  };

  const timeline = includeTimeline ? buildTimeline(diffParts, totalDays) : undefined;
  const milestones = includeMilestones ? buildMilestones(later) : undefined;

  if (includeTime) {
    summary.totalHours = diffParts.hours ?? summary.totalHours;
    summary.totalMinutes = diffParts.minutes ?? summary.totalMinutes;
  }

  return {
    summary,
    timeline,
    milestones,
    weekdayBreakdown
  };
}

export function parseDateInput(
  raw: string,
  time: string,
  includeTime: boolean,
  label: string
): Date {
  if (!raw.trim()) {
    throw new Error(`${label} cannot be empty.`);
  }

  const baseDate = raw.trim() === 'today' ? new Date() : new Date(raw);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error(`${label} is not a valid date. Use YYYY-MM-DD.`);
  }

  if (includeTime && time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    baseDate.setHours(hours, minutes, 0, 0);
  } else {
    baseDate.setHours(0, 0, 0, 0);
  }

  return baseDate;
}

export function computeDifferenceParts(
  start: Date,
  end: Date
): { years: number; months: number; days: number; hours?: number; minutes?: number } {
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

  const hours = end.getHours() - start.getHours();
  const minutes = end.getMinutes() - start.getMinutes();

  return { years, months, days, hours, minutes };
}

export function formatExactSpan(parts: {
  years: number;
  months: number;
  days: number;
}): string {
  const segments: string[] = [];
  if (parts.years) {
    segments.push(`${parts.years} year${parts.years === 1 ? '' : 's'}`);
  }
  if (parts.months) {
    segments.push(`${parts.months} month${parts.months === 1 ? '' : 's'}`);
  }
  if (parts.days || segments.length === 0) {
    segments.push(`${parts.days} day${parts.days === 1 ? '' : 's'}`);
  }
  return segments.join(', ');
}

export function computeBusinessDays(start: Date, end: Date): number {
  let businessDays = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      businessDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return businessDays;
}

export function computeWeekdayBreakdown(start: Date, end: Date): WeekdayBreakdown {
  let weekdays = 0;
  let weekendDays = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      weekendDays += 1;
    } else {
      weekdays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { weekdays, weekendDays, businessDays: weekdays };
}

export function buildTimeline(
  diff: { years: number; months: number; days: number },
  totalDays: number
): TimelineSegment[] {
  return [
    {
      label: 'Years',
      description: `${diff.years} full years in span`,
      days: diff.years * 365
    },
    {
      label: 'Months',
      description: `${diff.months} additional month${diff.months === 1 ? '' : 's'}`,
      days: diff.months * 30
    },
    {
      label: 'Remaining days',
      description: `Beyond complete months`,
      days: diff.days
    },
    {
      label: 'Total span',
      description: `Exact days in this interval`,
      days: totalDays
    }
  ];
}

export function buildMilestones(endDate: Date, now: Date = new Date()): Milestone[] {
  return DATE_DIFF_MILESTONE_OFFSETS.map((days) => {
    const target = new Date(now.getTime() + days * MS_IN_DAY);
    if (target > endDate) {
      return null;
    }
    return {
      label: `${days}-day mark from today`,
      description: `Occurs on ${formatDate(target)}`,
      targetDate: formatDate(target),
      remaining: computeCountdown(now, target)
    };
  }).filter((item): item is Milestone => item !== null);
}

export function computeCountdown(from: Date, to: Date): Countdown {
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

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function buildDurationSegments(
  timeline: TimelineSegment[] | undefined,
  totalDays: number
): TimelineSegmentWithProportion[] {
  if (!totalDays || !timeline?.length) {
    return [];
  }
  return timeline.map((segment) => ({
    ...segment,
    proportion: Math.min(100, Math.max(0.5, (segment.days / totalDays) * 100))
  }));
}

export function formatCountdown(value: Countdown | undefined): string {
  if (!value) {
    return '';
  }
  return `${value.months} month${value.months === 1 ? '' : 's'} · ${value.days} day${value.days === 1 ? '' : 's'} · ${value.hours} hour${value.hours === 1 ? '' : 's'}`;
}

export function formatDateDiffResultText(result: DateDiffResult): string {
  const summary = result.summary;
  return [
    `${summary.startDateLabel} → ${summary.endDateLabel}`,
    `Span: ${summary.exactSpan}`,
    `Total days: ${summary.totalDays}`,
    summary.businessDays !== undefined ? `Business days: ${summary.businessDays}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function prependDateDiffHistory(
  current: DateDiffHistory[],
  entry: DateDiffHistory,
  limit: number = DATE_DIFF_HISTORY_LIMIT
): DateDiffHistory[] {
  const filtered = current.filter(
    (item) =>
      !(
        item.startDate === entry.startDate &&
        item.endDate === entry.endDate &&
        item.includeTime === entry.includeTime
      )
  );
  return [{ ...entry }, ...filtered].slice(0, limit);
}

export function mapDateDiffCalculationError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to compute date difference.';
}

export function resolveDateDiffSuggestion(
  context: DateDiffSuggestionContext
): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    totalDays,
    isForward,
    includeTime,
    countBusinessDays,
    businessDays
  } = context;

  if (hasError) {
    return {
      id: 'ddc-invalid-date',
      title: 'Check your date inputs',
      reason:
        'Start and end must be valid YYYY-MM-DD values (or today). Date to Day of Week can help verify a single date.',
      actionLabel: 'Open Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  if (hasResult && !isForward) {
    return {
      id: 'ddc-reversed',
      title: 'Dates were ordered for you',
      reason:
        'The end date was earlier than the start, so the span uses chronological order. Age Calculator is useful when the earlier date is a birth date.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  if (hasResult && totalDays >= DATE_DIFF_LONG_SPAN_DAYS) {
    return {
      id: 'ddc-long-span',
      title: 'Long interval detected',
      reason:
        'Multi-year spans often need age-style breakdowns and birthday countdowns. Age Calculator focuses on that view.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  if (hasResult && countBusinessDays && businessDays !== undefined) {
    return {
      id: 'ddc-business',
      title: 'Planning around business days?',
      reason:
        'Date to Day of Week shows which weekday your start and end land on when scheduling work.',
      actionLabel: 'Open Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  if (hasResult && includeTime) {
    return {
      id: 'ddc-timezone',
      title: 'Times across regions?',
      reason:
        'Timezone Converter helps align start/end times when collaborators sit in different zones.',
      actionLabel: 'Open Timezone Converter',
      path: '/fun-tools/timezone-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'ddc-weekday',
      title: 'Curious about the weekdays?',
      reason:
        'Date to Day of Week confirms the weekday for either end of this interval.',
      actionLabel: 'Open Day of Week',
      path: '/math-date-utils/date-to-day-of-week'
    };
  }

  return {
    id: 'ddc-start',
    title: 'Pick a start and end date',
    reason:
      'The difference updates live. Age Calculator is a natural next step for birth-to-today spans.',
    actionLabel: 'Open Age Calculator',
    path: '/math-date-utils/age-calculator'
  };
}
