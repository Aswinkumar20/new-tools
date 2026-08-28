/** Read-only calendar view modes for the ICS viewer. */
export type IcsCalendarViewMode =
  | 'month'
  | 'week'
  | 'workWeek'
  | 'day'
  | 'agenda'
  | 'list'
  | 'year';

export type IcsEventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED' | string;
export type IcsEventClass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | string;
export type IcsPartStat =
  | 'NEEDS-ACTION'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'TENTATIVE'
  | 'DELEGATED'
  | string;

/** Participant (organizer or attendee) — display only. */
export interface IcsParticipant {
  name?: string;
  email?: string;
  role?: string;
  partStat?: IcsPartStat;
  rsvp?: boolean;
  cutype?: string;
  raw: string;
}

export interface IcsReminder {
  trigger: string;
  action?: string;
  description?: string;
  summary?: string;
}

export interface IcsRecurrenceInfo {
  rrule?: string;
  rdates: string[];
  exdates: string[];
  summary: string;
}

/** Canonical read-only event model for visualization. */
export interface IcsCalendarEvent {
  id: string;
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  timezone?: string;
  status?: IcsEventStatus;
  classification?: IcsEventClass;
  categories: string[];
  organizer?: IcsParticipant;
  attendees: IcsParticipant[];
  recurrence?: IcsRecurrenceInfo;
  reminders: IcsReminder[];
  url?: string;
  priority?: number;
  sequence?: number;
  created?: Date;
  lastModified?: Date;
  calendarName?: string;
  colorIndex: number;
  /** True when this row is an expanded occurrence of a recurring master. */
  isOccurrence: boolean;
  occurrenceStart?: Date;
  /** Contiguous multi-day span helpers for month/week rendering. */
  spanDays: number;
}

export interface IcsCalendarMeta {
  productId?: string;
  version?: string;
  calendarName?: string;
  calendarDescription?: string;
  timezone?: string;
  method?: string;
  scale?: string;
}

export interface IcsLoadedFile {
  id: string;
  name: string;
  size: number;
  sizeLabel: string;
  lastModified: number;
  objectUrl: string;
  rawText: string;
  meta: IcsCalendarMeta;
  /** Master events before range expansion. */
  masters: IcsCalendarEvent[];
  warnings: string[];
  eventCount: number;
  colorIndex: number;
  visible: boolean;
}

export interface IcsParseResult {
  meta: IcsCalendarMeta;
  masters: IcsCalendarEvent[];
  warnings: string[];
}

export interface IcsFilterState {
  search: string;
  categories: string[];
  statuses: string[];
  calendars: string[];
  allDayOnly: boolean;
  recurringOnly: boolean;
  hasAttendeesOnly: boolean;
}

export interface IcsMonthCell {
  date: Date;
  isoDate: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  weekNumber: number;
  events: IcsCalendarEvent[];
  overflowCount: number;
}

export interface IcsAgendaGroup {
  isoDate: string;
  label: string;
  isToday: boolean;
  events: IcsCalendarEvent[];
}

export interface IcsYearMonth {
  year: number;
  month: number;
  label: string;
  days: Array<{
    date: Date;
    isoDate: string;
    inMonth: boolean;
    isToday: boolean;
    eventCount: number;
  }>;
}

export interface IcsTimeSlotEvent {
  event: IcsCalendarEvent;
  topPct: number;
  heightPct: number;
  column: number;
  columnCount: number;
  startsBefore: boolean;
  endsAfter: boolean;
}

export interface IcsDayColumn {
  date: Date;
  isoDate: string;
  label: string;
  weekdayLabel: string;
  isToday: boolean;
  allDayEvents: IcsCalendarEvent[];
  timedEvents: IcsTimeSlotEvent[];
}

export interface IcsViewerStats {
  events: number;
  calendars: number;
  allDay: number;
  recurring: number;
  categories: number;
}
