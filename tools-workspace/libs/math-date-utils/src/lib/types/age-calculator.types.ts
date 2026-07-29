import type { FormControl, FormGroup } from '@angular/forms';

export type AnchorOption = 'now' | 'specific';

export interface AnchorDefinition {
  id: AnchorOption;
  label: string;
  description: string;
}

export interface AgeCalculatorOptions {
  birthDate: Date;
  comparisonDate: Date;
  includeTime: boolean;
  includeZodiac: boolean;
  includeMilestones: boolean;
  showTimeline: boolean;
}

export interface AgeResult {
  summary: AgeSummary;
  totalDays: number;
  timeline?: TimelineItem[];
  milestones?: MilestoneItem[];
  zodiac?: ZodiacInfo;
}

export interface AgeSummary {
  years: number;
  months: number;
  days: number;
  hours?: number;
  minutes?: number;
  nextBirthday: string;
  nextBirthdayCountdown: CountdownBreakdown;
  exactAge: string;
  ageInUnits: AgeUnits;
}

export interface AgeUnits {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface CountdownBreakdown {
  months: number;
  days: number;
  hours: number;
}

export interface TimelineItem {
  label: string;
  description: string;
  days: number;
}

export interface TimelineSegment extends TimelineItem {
  proportion: number;
}

export interface MilestoneItem {
  label: string;
  description: string;
  targetDate: string;
  remaining: CountdownBreakdown;
}

export interface ZodiacInfo {
  western: string;
  chinese: string;
}

export interface AgeHistory extends AgeResult {
  birthDate: string;
  comparisonDate: string;
  birthTime: string;
  comparisonTime: string;
  anchor: AnchorOption;
  includeTime: boolean;
  includeZodiac: boolean;
  includeMilestones: boolean;
  showTimeline: boolean;
}

export interface AgePreset {
  label: string;
  birthDate: string;
  comparisonDate: string;
  anchor?: AnchorOption;
  includeTime?: boolean;
  birthTime?: string;
  comparisonTime?: string;
}

export type AgeCalculatorFormGroup = FormGroup<{
  birthDate: FormControl<string | null>;
  comparisonDate: FormControl<string | null>;
  anchor: FormControl<AnchorOption>;
  includeTime: FormControl<boolean>;
  birthTime: FormControl<string | null>;
  comparisonTime: FormControl<string | null>;
  showTimeline: FormControl<boolean>;
  includeZodiac: FormControl<boolean>;
  includeMilestones: FormControl<boolean>;
}>;

export interface AgeCalculatorFormValues {
  birthDate: string;
  comparisonDate: string;
  anchor: AnchorOption;
  includeTime: boolean;
  birthTime: string;
  comparisonTime: string;
  showTimeline: boolean;
  includeZodiac: boolean;
  includeMilestones: boolean;
}

export interface AgeSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  anchor: AnchorOption;
  includeZodiac: boolean;
  totalDays: number;
  years: number;
}
