import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  ICS_HOUR_END,
  ICS_HOUR_START,
  ICS_MAX_FILE_BYTES,
  ICS_MONTH_OVERFLOW_LIMIT,
  ICS_SUPPORTED_EXTENSIONS,
  ICS_WORK_WEEK_DAYS
} from '../constants/ics-viewer.constants';
import type {
  IcsAgendaGroup,
  IcsCalendarEvent,
  IcsCalendarViewMode,
  IcsDayColumn,
  IcsFilterState,
  IcsLoadedFile,
  IcsMonthCell,
  IcsTimeSlotEvent,
  IcsViewerStats,
  IcsYearMonth
} from '../types/ics-viewer.types';

export function getIcsFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function isSupportedIcsFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = ICS_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getIcsFileExtension(file.name);
  if (extensions.includes(ext)) {
    return true;
  }
  const type = file.type.toLowerCase();
  return (
    type === 'text/calendar' ||
    type === 'application/ics' ||
    type === 'application/x-icalendar' ||
    type.includes('calendar')
  );
}

export function validateIcsFileSize(
  file: Pick<File, 'size' | 'name'>,
  maxBytes = ICS_MAX_FILE_BYTES
): string | null {
  if (file.size <= 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `"${file.name}" exceeds the ${mb} MB limit.`;
  }
  return null;
}

export function filterValidIcsFiles(files: File[]): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (!isSupportedIcsFile(file)) {
      errors.push(`"${file.name}" is not a supported calendar file (.ics).`);
      continue;
    }
    const sizeError = validateIcsFileSize(file);
    if (sizeError) {
      errors.push(sizeError);
      continue;
    }
    valid.push(file);
  }
  return { valid, errors };
}

export function formatIcsFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createIcsFileId(): string {
  return `ics-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoWeekNumber(date: Date): number {
  const target = startOfDay(date);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - startOfDay(firstThursday).getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Monday-based week start containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function endOfWeek(date: Date): Date {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function visibleRangeForView(
  viewMode: IcsCalendarViewMode,
  anchor: Date
): { start: Date; end: Date } {
  switch (viewMode) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case 'week':
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    case 'workWeek': {
      const weekStart = startOfWeek(anchor);
      return { start: weekStart, end: endOfDay(addDays(weekStart, 4)) };
    }
    case 'month':
    case 'agenda':
      return {
        start: startOfWeek(startOfMonth(anchor)),
        end: endOfWeek(endOfMonth(anchor))
      };
    case 'list':
      return {
        start: startOfMonth(anchor),
        end: endOfDay(addMonths(startOfMonth(anchor), 3))
      };
    case 'year':
      return {
        start: new Date(anchor.getFullYear(), 0, 1),
        end: endOfDay(new Date(anchor.getFullYear(), 11, 31))
      };
    default:
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
}

export function navigateAnchor(
  viewMode: IcsCalendarViewMode,
  anchor: Date,
  direction: -1 | 1
): Date {
  switch (viewMode) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
    case 'workWeek':
      return addDays(anchor, direction * 7);
    case 'year':
      return addYears(anchor, direction);
    case 'list':
      return addMonths(anchor, direction);
    case 'month':
    case 'agenda':
    default:
      return addMonths(anchor, direction);
  }
}

export function formatViewTitle(viewMode: IcsCalendarViewMode, anchor: Date): string {
  const monthYear = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  switch (viewMode) {
    case 'day':
      return anchor.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    case 'week':
    case 'workWeek': {
      const start = startOfWeek(anchor);
      const end = addDays(start, viewMode === 'workWeek' ? 4 : 6);
      const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endLabel = end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return `${startLabel} – ${endLabel}`;
    }
    case 'year':
      return String(anchor.getFullYear());
    case 'list': {
      const end = addMonths(startOfMonth(anchor), 2);
      return `${monthYear} – ${end.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
    }
    default:
      return monthYear;
  }
}

export function formatEventTimeRange(event: IcsCalendarEvent, timeZone?: string): string {
  if (event.allDay) {
    if (event.spanDays > 1) {
      const last = addDays(event.start, event.spanDays - 1);
      return `${event.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · All day`;
    }
    return 'All day';
  }
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  };
  const start = event.start.toLocaleTimeString(undefined, opts);
  const end = event.end.toLocaleTimeString(undefined, opts);
  return `${start} – ${end}`;
}

export function formatDuration(event: IcsCalendarEvent): string {
  const ms = Math.max(0, event.end.getTime() - event.start.getTime());
  const minutes = Math.round(ms / 60_000);
  if (event.allDay) {
    return event.spanDays === 1 ? '1 day' : `${event.spanDays} days`;
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function matchesSearch(event: IcsCalendarEvent, query: string): boolean {
  if (!query) {
    return true;
  }
  const q = query.toLowerCase();
  const haystacks = [
    event.title,
    event.description,
    event.location,
    event.organizer?.name,
    event.organizer?.email,
    ...event.categories,
    ...event.attendees.map((a) => `${a.name ?? ''} ${a.email ?? ''}`)
  ];
  return haystacks.some((v) => (v ?? '').toLowerCase().includes(q));
}

export function filterEvents(
  events: ReadonlyArray<IcsCalendarEvent>,
  filters: IcsFilterState,
  visibleCalendarIds?: ReadonlySet<string>
): IcsCalendarEvent[] {
  return events.filter((event) => {
    if (visibleCalendarIds && event.calendarName && !visibleCalendarIds.has(event.calendarName)) {
      // When calendar names are used as toggle keys; also allow uid file ids via colorIndex path below.
    }
    if (filters.calendars.length > 0) {
      const key = event.calendarName ?? `cal-${event.colorIndex}`;
      if (!filters.calendars.includes(key)) {
        return false;
      }
    }
    if (filters.categories.length > 0) {
      if (!event.categories.some((c) => filters.categories.includes(c))) {
        return false;
      }
    }
    if (filters.statuses.length > 0) {
      if (!event.status || !filters.statuses.includes(event.status)) {
        return false;
      }
    }
    if (filters.allDayOnly && !event.allDay) {
      return false;
    }
    if (filters.recurringOnly && !event.recurrence && !event.isOccurrence) {
      return false;
    }
    if (filters.hasAttendeesOnly && event.attendees.length === 0) {
      return false;
    }
    return matchesSearch(event, filters.search.trim());
  });
}

export function buildViewerStats(events: ReadonlyArray<IcsCalendarEvent>): IcsViewerStats {
  const categories = new Set<string>();
  const calendars = new Set<string>();
  let allDay = 0;
  let recurring = 0;
  for (const event of events) {
    event.categories.forEach((c) => categories.add(c));
    calendars.add(event.calendarName ?? `Calendar ${event.colorIndex + 1}`);
    if (event.allDay) {
      allDay += 1;
    }
    if (event.recurrence || event.isOccurrence) {
      recurring += 1;
    }
  }
  return {
    events: events.length,
    calendars: calendars.size,
    allDay,
    recurring,
    categories: categories.size
  };
}

export function eventsOnDay(
  events: ReadonlyArray<IcsCalendarEvent>,
  day: Date
): IcsCalendarEvent[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  return events.filter((event) => {
    const start = event.start.getTime();
    // All-day DTEND is exclusive
    const end = event.allDay ? event.end.getTime() - 1 : event.end.getTime();
    return end >= dayStart && start <= dayEnd;
  });
}

export function buildMonthGrid(
  anchor: Date,
  events: ReadonlyArray<IcsCalendarEvent>,
  selected: Date,
  today = new Date()
): IcsMonthCell[] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells: IcsMonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const dayEvents = eventsOnDay(events, date);
    cells.push({
      date,
      isoDate: toIsoDate(date),
      inCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selected),
      weekNumber: isoWeekNumber(date),
      events: dayEvents.slice(0, ICS_MONTH_OVERFLOW_LIMIT),
      overflowCount: Math.max(0, dayEvents.length - ICS_MONTH_OVERFLOW_LIMIT)
    });
  }
  return cells;
}

export function buildAgendaGroups(
  events: ReadonlyArray<IcsCalendarEvent>,
  rangeStart: Date,
  rangeEnd: Date,
  today = new Date()
): IcsAgendaGroup[] {
  const groups = new Map<string, IcsAgendaGroup>();
  let cursor = startOfDay(rangeStart);
  const last = startOfDay(rangeEnd);
  while (cursor.getTime() <= last.getTime()) {
    const dayEvents = eventsOnDay(events, cursor);
    if (dayEvents.length > 0) {
      const iso = toIsoDate(cursor);
      groups.set(iso, {
        isoDate: iso,
        label: cursor.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        isToday: isSameDay(cursor, today),
        events: dayEvents
      });
    }
    cursor = addDays(cursor, 1);
  }
  return [...groups.values()];
}

function layoutOverlaps(dayEvents: IcsCalendarEvent[]): IcsTimeSlotEvent[] {
  const timed = dayEvents
    .filter((e) => !e.allDay)
    .map((event) => {
      const dayStart = startOfDay(event.start);
      // Clamp to the event's start day for single-day column layout.
      const startMs = Math.max(event.start.getTime(), dayStart.getTime());
      const endMs = Math.min(event.end.getTime(), endOfDay(event.start).getTime());
      const dayMs = 24 * 60 * 60 * 1000;
      const topPct = ((startMs - dayStart.getTime()) / dayMs) * 100;
      const heightPct = Math.max(2, ((endMs - startMs) / dayMs) * 100);
      return {
        event,
        topPct,
        heightPct,
        column: 0,
        columnCount: 1,
        startsBefore: event.start.getTime() < dayStart.getTime(),
        endsAfter: event.end.getTime() > endOfDay(event.start).getTime(),
        _start: startMs,
        _end: endMs
      };
    })
    .sort((a, b) => a._start - b._start || b._end - a._end);

  // Greedy column packing
  const columns: number[] = [];
  for (const item of timed) {
    let col = 0;
    while (columns[col] != null && columns[col] > item._start) {
      col += 1;
    }
    columns[col] = item._end;
    item.column = col;
  }
  const columnCount = Math.max(1, columns.length);
  return timed.map(({ _start: _s, _end: _e, ...rest }) => ({
    ...rest,
    columnCount
  }));
}

export function buildDayColumns(
  dates: Date[],
  events: ReadonlyArray<IcsCalendarEvent>,
  today = new Date()
): IcsDayColumn[] {
  return dates.map((date) => {
    const dayEvents = eventsOnDay(events, date);
    // For multi-day all-day: include if day is within [start, end)
    const allDayEvents = dayEvents.filter((e) => e.allDay);
    const timedSource = dayEvents.filter((e) => !e.allDay);
    // Re-layout timed events clamped to this column day
    const timedForDay = timedSource.map((event) => {
      const colStart = startOfDay(date);
      const colEnd = endOfDay(date);
      const start = new Date(Math.max(event.start.getTime(), colStart.getTime()));
      const end = new Date(Math.min(event.end.getTime(), colEnd.getTime() + 1));
      return { ...event, start, end };
    });
    return {
      date,
      isoDate: toIsoDate(date),
      label: String(date.getDate()),
      weekdayLabel: date.toLocaleDateString(undefined, { weekday: 'short' }),
      isToday: isSameDay(date, today),
      allDayEvents,
      timedEvents: layoutOverlaps(timedForDay)
    };
  });
}

export function datesForView(viewMode: IcsCalendarViewMode, anchor: Date): Date[] {
  if (viewMode === 'day') {
    return [startOfDay(anchor)];
  }
  const weekStart = startOfWeek(anchor);
  if (viewMode === 'workWeek') {
    return ICS_WORK_WEEK_DAYS.map((d) => addDays(weekStart, d - 1));
  }
  if (viewMode === 'week') {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }
  return [];
}

export function buildYearMonths(
  year: number,
  events: ReadonlyArray<IcsCalendarEvent>,
  today = new Date()
): IcsYearMonth[] {
  return Array.from({ length: 12 }, (_, month) => {
    const first = new Date(year, month, 1);
    const gridStart = startOfWeek(first);
    const days = Array.from({ length: 42 }, (__, i) => {
      const date = addDays(gridStart, i);
      return {
        date,
        isoDate: toIsoDate(date),
        inMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        eventCount: eventsOnDay(events, date).length
      };
    });
    return {
      year,
      month,
      label: first.toLocaleDateString(undefined, { month: 'long' }),
      days
    };
  });
}

export function hourLabels(): string[] {
  const labels: string[] = [];
  for (let h = ICS_HOUR_START; h < ICS_HOUR_END; h++) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    labels.push(d.toLocaleTimeString(undefined, { hour: 'numeric' }));
  }
  return labels;
}

export function currentTimeTopPct(now = new Date()): number {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes / (24 * 60)) * 100;
}

export function collectFilterOptions(events: ReadonlyArray<IcsCalendarEvent>): {
  categories: string[];
  statuses: string[];
  calendars: string[];
} {
  const categories = new Set<string>();
  const statuses = new Set<string>();
  const calendars = new Set<string>();
  for (const event of events) {
    event.categories.forEach((c) => categories.add(c));
    if (event.status) {
      statuses.add(event.status);
    }
    calendars.add(event.calendarName ?? `Calendar ${event.colorIndex + 1}`);
  }
  return {
    categories: [...categories].sort(),
    statuses: [...statuses].sort(),
    calendars: [...calendars].sort()
  };
}

export function activeFilterCount(filters: IcsFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.categories.length) count += 1;
  if (filters.statuses.length) count += 1;
  if (filters.calendars.length) count += 1;
  if (filters.allDayOnly) count += 1;
  if (filters.recurringOnly) count += 1;
  if (filters.hasAttendeesOnly) count += 1;
  return count;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/calendar'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resolveIcsSuggestion(input: {
  hasFiles: boolean;
  hasError: boolean;
  eventCount: number;
}): FvToolSuggestion | null {
  if (input.hasError) {
    return {
      id: 'ics-text-fallback',
      title: 'Inspect the raw file?',
      reason: 'Open the source in Text File Viewer to check encoding or corruption.',
      actionLabel: 'Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }
  if (!input.hasFiles) {
    return {
      id: 'ics-intro',
      title: 'Open a calendar export',
      reason: 'Upload an .ics from Google, Apple, or Outlook — or load the sample roadmap.',
      actionLabel: 'Related date tools',
      path: '/math-date-utils/date-difference-calculator'
    };
  }
  if (input.eventCount === 0) {
    return {
      id: 'ics-empty',
      title: 'No events found',
      reason: 'Try another export, or confirm the file includes VEVENT components.',
      actionLabel: 'File metadata',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }
  return null;
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

export type { IcsLoadedFile };
