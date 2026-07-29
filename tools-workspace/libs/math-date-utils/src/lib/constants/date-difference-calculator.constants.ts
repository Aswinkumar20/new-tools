import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  DateDiffPreset,
  DateDifferenceFormValues
} from '../types/date-difference-calculator.types';

export const MS_IN_DAY = 1000 * 60 * 60 * 24;

export const DATE_DIFF_HISTORY_LIMIT = 9;

export const DATE_DIFF_DEFAULT_FORM: DateDifferenceFormValues = {
  startDate: '2023-01-01',
  endDate: 'today',
  includeTime: false,
  startTime: '08:30',
  endTime: '17:15',
  countBusinessDays: true,
  includeTimeline: true,
  includeMilestones: true,
  includeWeekdayBreakdown: true
};

/** Milestone offsets (days from today) used when milestones are enabled. */
export const DATE_DIFF_MILESTONE_OFFSETS: ReadonlyArray<number> = [30, 90, 180, 365, 730];

/** Spans at or above this many days often benefit from age-oriented tooling. */
export const DATE_DIFF_LONG_SPAN_DAYS = 365;

export const DATE_DIFF_PRESETS: ReadonlyArray<DateDiffPreset> = [
  {
    label: 'Project quarter',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    countBusinessDays: true
  },
  {
    label: 'Fiscal half year',
    startDate: '2023-04-01',
    endDate: '2023-09-30',
    countBusinessDays: true,
    includeMilestones: true
  },
  {
    label: 'Conference countdown',
    startDate: 'today',
    endDate: '2024-11-05',
    includeTime: true,
    startTime: '09:00',
    endTime: '08:30'
  },
  {
    label: 'Warranty check',
    startDate: '2022-07-15',
    endDate: 'today',
    countBusinessDays: false
  },
  {
    label: '100 day planning',
    startDate: 'today',
    endDate: '2024-09-15',
    includeMilestones: true
  }
];

export const DATE_DIFF_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Age Calculator',
    path: '/math-date-utils/age-calculator',
    description: 'Turn long spans into exact age and birthday countdowns'
  },
  {
    label: 'Date to Day of Week',
    path: '/math-date-utils/date-to-day-of-week',
    description: 'See which weekday start or end dates fall on'
  },
  {
    label: 'Timezone Converter',
    path: '/fun-tools/timezone-converter',
    description: 'Align event times across regions after picking dates'
  },
  {
    label: 'Zodiac Finder',
    path: '/math-date-utils/zodiac-finder',
    description: 'Explore zodiac signs for a birth or event date'
  }
];
