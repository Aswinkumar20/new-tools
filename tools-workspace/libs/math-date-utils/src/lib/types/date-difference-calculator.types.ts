import type { FormControl, FormGroup } from '@angular/forms';

export interface DateDiffPreset {
  label: string;
  startDate: string;
  endDate: string;
  includeTime?: boolean;
  startTime?: string;
  endTime?: string;
  countBusinessDays?: boolean;
  includeMilestones?: boolean;
}

export interface TimelineSegment {
  label: string;
  description: string;
  days: number;
}

export interface TimelineSegmentWithProportion extends TimelineSegment {
  proportion: number;
}

export interface Countdown {
  months: number;
  days: number;
  hours: number;
}

export interface Milestone {
  label: string;
  description: string;
  targetDate: string;
  remaining: Countdown;
}

export interface WeekdayBreakdown {
  weekdays: number;
  weekendDays: number;
  businessDays?: number;
}

export interface DateDiffSummary {
  isForward: boolean;
  startDateLabel: string;
  endDateLabel: string;
  exactSpan: string;
  totalYears: number;
  totalMonths: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  businessDays?: number;
}

export interface DateDiffResult {
  summary: DateDiffSummary;
  timeline?: TimelineSegment[];
  milestones?: Milestone[];
  weekdayBreakdown?: WeekdayBreakdown;
}

export interface DateDiffHistory extends DateDiffResult {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  includeTime: boolean;
  includeTimeline: boolean;
  includeMilestones: boolean;
  countBusinessDays: boolean;
  includeWeekdayBreakdown: boolean;
}

export interface DateDiffCalculatorOptions {
  startDate: Date;
  endDate: Date;
  includeTime: boolean;
  includeTimeline: boolean;
  includeMilestones: boolean;
  countBusinessDays: boolean;
  includeWeekdayBreakdown: boolean;
}

export type DateDifferenceFormGroup = FormGroup<{
  startDate: FormControl<string | null>;
  endDate: FormControl<string | null>;
  includeTime: FormControl<boolean>;
  startTime: FormControl<string | null>;
  endTime: FormControl<string | null>;
  countBusinessDays: FormControl<boolean>;
  includeTimeline: FormControl<boolean>;
  includeMilestones: FormControl<boolean>;
  includeWeekdayBreakdown: FormControl<boolean>;
}>;

export interface DateDifferenceFormValues {
  startDate: string;
  endDate: string;
  includeTime: boolean;
  startTime: string;
  endTime: string;
  countBusinessDays: boolean;
  includeTimeline: boolean;
  includeMilestones: boolean;
  includeWeekdayBreakdown: boolean;
}

export interface DateDiffSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  totalDays: number;
  isForward: boolean;
  includeTime: boolean;
  countBusinessDays: boolean;
  businessDays?: number;
}
