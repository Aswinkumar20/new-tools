import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { IcsCalendarViewMode, IcsFilterState } from '../types/ics-viewer.types';

export const ICS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ics', '.ical', '.ifb'];

export const ICS_ACCEPT_ATTR =
  '.ics,.ical,.ifb,text/calendar,application/ics,application/x-icalendar';

export const ICS_FORMATS_LABEL = 'ICS, iCal';
export const ICS_FORMATS_HINT = 'Apple Calendar, Google Calendar, Outlook exports (.ics)';

/** Keep pathological calendars from locking the tab. */
export const ICS_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const ICS_MONTH_OVERFLOW_LIMIT = 3;
export const ICS_HOUR_START = 0;
export const ICS_HOUR_END = 24;
export const ICS_HOUR_HEIGHT_PX = 48;
export const ICS_WORK_WEEK_DAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5]; // Mon–Fri
export const ICS_CURRENT_TIME_TICK_MS = 60_000;
export const ICS_MAX_RECURRENCE_OCCURRENCES = 2500;
export const ICS_DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

export const ICS_VIEW_OPTIONS: ReadonlyArray<{ id: IcsCalendarViewMode; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'workWeek', label: 'Work week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'list', label: 'List' },
  { id: 'year', label: 'Year' }
];

/** Display-only timezone choices. Changing these never mutates event data. */
export const ICS_TIMEZONE_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' }
];

export const ICS_EVENT_COLORS: ReadonlyArray<string> = [
  '#075fbd',
  '#0f766e',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#15803d',
  '#c2410c'
];

export const ICS_DEFAULT_FILTERS: IcsFilterState = {
  search: '',
  categories: [],
  statuses: [],
  calendars: [],
  allDayOnly: false,
  recurringOnly: false,
  hasAttendeesOnly: false
};

export const ICS_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Inspect raw ICS source when you need the underlying markup'
  },
  {
    label: 'Log Viewer',
    path: '/file-viewers/log-viewer',
    description: 'Search large calendar export dumps line by line'
  },
  {
    label: 'Date Difference Calculator',
    path: '/math-date-utils/date-difference-calculator',
    description: 'Measure gaps between event dates outside the calendar grid'
  },
  {
    label: 'Date to Day of Week',
    path: '/math-date-utils/date-to-day-of-week',
    description: 'Quick weekday lookup for planning around imported events'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type and size for unusual calendar packages'
  }
];
