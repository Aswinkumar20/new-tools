import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type { AgeCalculatorFormValues, AgePreset, AnchorDefinition } from '../types/age-calculator.types';

export const MS_IN_DAY = 1000 * 60 * 60 * 24;

export const AGE_HISTORY_LIMIT = 9;

export const AGE_DEFAULT_FORM: AgeCalculatorFormValues = {
  birthDate: '1995-05-12',
  comparisonDate: 'today',
  anchor: 'now',
  includeTime: false,
  birthTime: '00:00',
  comparisonTime: '00:00',
  showTimeline: true,
  includeZodiac: true,
  includeMilestones: true
};

export const AGE_ANCHORS: ReadonlyArray<AnchorDefinition> = [
  {
    id: 'now',
    label: 'Compare to today',
    description: 'Keeps comparison date in sync with the current moment.'
  },
  {
    id: 'specific',
    label: 'Compare to specific date',
    description: 'Choose a fixed comparison date for planning or retrospectives.'
  }
];

export const AGE_PRESETS: ReadonlyArray<AgePreset> = [
  {
    label: 'Millennial 30th birthday',
    birthDate: '1994-08-15',
    comparisonDate: '2024-08-15',
    anchor: 'specific'
  },
  {
    label: 'Gen Alpha (12 y)',
    birthDate: '2012-03-20',
    comparisonDate: 'today',
    anchor: 'now'
  },
  {
    label: 'Retirement planning',
    birthDate: '1975-11-02',
    comparisonDate: '2035-01-01',
    anchor: 'specific'
  },
  {
    label: 'Newborn',
    birthDate: '2024-01-10',
    comparisonDate: 'today',
    anchor: 'now',
    includeTime: true,
    birthTime: '05:45'
  }
];

/** Ages under this many days often need day-level planning tools. */
export const AGE_INFANT_DAYS_THRESHOLD = 365;

/** Ages at or above this many years may benefit from long-span date tools. */
export const AGE_SENIOR_YEARS_THRESHOLD = 60;

export const AGE_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Date Difference Calculator',
    path: '/math-date-utils/date-difference-calculator',
    description: 'Measure exact spans between any two dates'
  },
  {
    label: 'Zodiac Finder',
    path: '/math-date-utils/zodiac-finder',
    description: 'Explore Western and Chinese signs in more detail'
  },
  {
    label: 'Date to Day of Week',
    path: '/math-date-utils/date-to-day-of-week',
    description: 'See which weekday a birthday or milestone falls on'
  },
  {
    label: 'Timezone Converter',
    path: '/fun-tools/timezone-converter',
    description: 'Convert birth or event times across zones'
  }
];

export const WESTERN_ZODIAC_SIGNS: ReadonlyArray<{ sign: string; start: readonly [number, number] }> = [
  { sign: 'Capricorn', start: [12, 22] },
  { sign: 'Aquarius', start: [1, 20] },
  { sign: 'Pisces', start: [2, 19] },
  { sign: 'Aries', start: [3, 21] },
  { sign: 'Taurus', start: [4, 20] },
  { sign: 'Gemini', start: [5, 21] },
  { sign: 'Cancer', start: [6, 21] },
  { sign: 'Leo', start: [7, 23] },
  { sign: 'Virgo', start: [8, 23] },
  { sign: 'Libra', start: [9, 23] },
  { sign: 'Scorpio', start: [10, 23] },
  { sign: 'Sagittarius', start: [11, 22] },
  { sign: 'Capricorn', start: [12, 31] }
];

export const CHINESE_ZODIAC_ANIMALS: ReadonlyArray<string> = [
  'Rat',
  'Ox',
  'Tiger',
  'Rabbit',
  'Dragon',
  'Snake',
  'Horse',
  'Goat',
  'Monkey',
  'Rooster',
  'Dog',
  'Pig'
];

export const AGE_MILESTONE_OFFSETS: ReadonlyArray<{ label: string; offsetDays: number }> = [
  { label: '10,000 days', offsetDays: 10000 },
  { label: '20,000 days', offsetDays: 20000 },
  { label: '100th birthday', offsetDays: 36525 }
];
