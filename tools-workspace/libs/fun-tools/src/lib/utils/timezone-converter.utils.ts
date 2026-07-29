import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import { TIMEZONE_LARGE_DIFF_HOURS } from '../constants/timezone-converter.constants';
import type {
  TimezoneConversionResult,
  TimezoneFormValues,
  TimezoneOption
} from '../types/timezone-converter.types';

/** datetime-local value for the current local wall clock (YYYY-MM-DDTHH:mm). */
export function formatLocalDateTimeInput(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function detectBrowserTimezone(fallback = 'UTC'): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export function formatTimeInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return tzDate.getTime() - utcDate.getTime();
}

export function formatTimezoneOffsetLabel(date: Date, timezone: string): string {
  const offsetMs = getTimezoneOffsetMs(date, timezone);
  const offsetHours = offsetMs / (1000 * 60 * 60);
  const sign = offsetHours >= 0 ? '+' : '-';
  const hours = Math.abs(Math.floor(offsetHours));
  const minutes = Math.abs(Math.floor((offsetHours % 1) * 60));
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function resolveTimezoneLabel(
  value: string,
  catalog: ReadonlyArray<TimezoneOption>
): string {
  return catalog.find((tz) => tz.value === value)?.label ?? value;
}

export function formatTimezoneDifference(
  date: Date,
  sourceTimezone: string,
  targetTimezone: string
): string {
  const diffMs =
    getTimezoneOffsetMs(date, targetTimezone) - getTimezoneOffsetMs(date, sourceTimezone);
  const diffHours = Math.abs(diffMs / (1000 * 60 * 60));
  const hours = Math.floor(diffHours);
  const minutes = Math.floor((diffHours % 1) * 60);
  const sign = diffMs >= 0 ? '+' : '-';
  if (hours === 0) {
    return `${sign}${minutes} minutes`;
  }
  if (minutes === 0) {
    return `${sign}${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${sign}${hours}h ${minutes}m`;
}

export function absoluteTimezoneDiffHours(
  date: Date,
  sourceTimezone: string,
  targetTimezone: string
): number {
  const diffMs =
    getTimezoneOffsetMs(date, targetTimezone) - getTimezoneOffsetMs(date, sourceTimezone);
  return Math.abs(diffMs / (1000 * 60 * 60));
}

export function buildTimezoneConversion(
  values: TimezoneFormValues,
  catalog: ReadonlyArray<TimezoneOption>
): TimezoneConversionResult | null {
  const { dateTime, sourceTimezone, targetTimezone } = values;
  if (!dateTime || !sourceTimezone || !targetTimezone) {
    return null;
  }

  try {
    const inputDate = new Date(dateTime);
    if (isNaN(inputDate.getTime())) {
      return null;
    }

    return {
      source: {
        time: formatTimeInTimezone(inputDate, sourceTimezone),
        timezone: resolveTimezoneLabel(sourceTimezone, catalog),
        offset: formatTimezoneOffsetLabel(inputDate, sourceTimezone)
      },
      target: {
        time: formatTimeInTimezone(inputDate, targetTimezone),
        timezone: resolveTimezoneLabel(targetTimezone, catalog),
        offset: formatTimezoneOffsetLabel(inputDate, targetTimezone)
      },
      difference: formatTimezoneDifference(inputDate, sourceTimezone, targetTimezone)
    };
  } catch {
    return null;
  }
}

export function formatConversionOutputText(conversion: TimezoneConversionResult): string {
  return [
    `Source: ${conversion.source.time} (${conversion.source.timezone}, ${conversion.source.offset})`,
    `Target: ${conversion.target.time} (${conversion.target.timezone}, ${conversion.target.offset})`,
    `Difference: ${conversion.difference}`
  ].join('\n');
}

export function swapTimezonePair(
  sourceTimezone: string,
  targetTimezone: string
): Pick<TimezoneFormValues, 'sourceTimezone' | 'targetTimezone'> {
  return { sourceTimezone: targetTimezone, targetTimezone: sourceTimezone };
}

export function resolveTimezoneSuggestion(options: {
  sourceTimezone: string;
  targetTimezone: string;
  hasConversion: boolean;
  absoluteDiffHours: number;
}): FtToolSuggestion | null {
  const { sourceTimezone, targetTimezone, hasConversion, absoluteDiffHours } = options;

  if (sourceTimezone && targetTimezone && sourceTimezone === targetTimezone) {
    return {
      id: 'tzc-same-zone',
      title: 'Source and target match',
      reason:
        'Both zones are the same, so the conversion will show identical wall times. Swap or pick a different target.',
      actionLabel: 'Open Stopwatch Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  if (hasConversion && absoluteDiffHours >= TIMEZONE_LARGE_DIFF_HOURS) {
    return {
      id: 'tzc-large-diff',
      title: 'Large timezone gap detected',
      reason:
        'An 8+ hour offset often needs meeting buffers. Use Stopwatch Timer to time handoffs or rehearsal calls.',
      actionLabel: 'Open Stopwatch Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  if (hasConversion) {
    return {
      id: 'tzc-pomodoro',
      title: 'Planning a focus block across zones?',
      reason:
        'Pomodoro Timer helps schedule work/break intervals that fit the converted local time.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  return {
    id: 'tzc-start',
    title: 'Convert a meeting time',
    reason:
      'Pick date/time and zones to see live offsets. Stopwatch Timer is handy once you need to time the call itself.',
    actionLabel: 'Open Stopwatch Timer',
    path: '/fun-tools/stopwatch-timer'
  };
}
