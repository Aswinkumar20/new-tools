import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type { LocaleOption, TimezoneOption } from '../types/date-to-day-of-week.types';

export const DATE_DOW_HISTORY_LIMIT = 8;

export const DATE_DOW_DEFAULT_LOCALE =
  typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

export const DATE_DOW_DEFAULT_TZ =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
    : 'UTC';

export const DATE_DOW_TIMEZONE_OPTIONS: ReadonlyArray<TimezoneOption> = [
  { value: DATE_DOW_DEFAULT_TZ, label: `Local · ${DATE_DOW_DEFAULT_TZ}`, region: 'Local' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', region: 'Global' },
  { value: 'America/New_York', label: 'New York (ET)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)', region: 'Americas' },
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Oceania' }
];

export const DATE_DOW_LOCALE_OPTIONS: ReadonlyArray<LocaleOption> = [
  { value: DATE_DOW_DEFAULT_LOCALE, label: `System default (${DATE_DOW_DEFAULT_LOCALE})` },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' }
];

/** Known new moon baseline used for approximate lunar phase (UTC). */
export const DATE_DOW_KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

export const DATE_DOW_SYNODIC_MONTH_DAYS = 29.530588853;

/** Absolute days from today that suggest longer-span date tools. */
export const DATE_DOW_LONG_RANGE_DAYS = 365;

export const DATE_DOW_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Date Difference Calculator',
    path: '/math-date-utils/date-difference-calculator',
    description: 'Measure the span from this date to today or another date'
  },
  {
    label: 'Age Calculator',
    path: '/math-date-utils/age-calculator',
    description: 'Turn a birth date into exact age and birthday countdowns'
  },
  {
    label: 'Zodiac Finder',
    path: '/math-date-utils/zodiac-finder',
    description: 'See Western and Chinese signs for the selected date'
  },
  {
    label: 'Timezone Converter',
    path: '/fun-tools/timezone-converter',
    description: 'Convert event times once you know the weekday'
  }
];
