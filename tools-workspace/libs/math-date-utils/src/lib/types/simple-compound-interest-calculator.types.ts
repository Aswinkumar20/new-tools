import type { FormControl, FormGroup } from '@angular/forms';

export type InterestMode = 'simple' | 'compound';
export type CompoundingFrequency =
  | 'annually'
  | 'semiannually'
  | 'quarterly'
  | 'monthly'
  | 'weekly'
  | 'daily';
export type ContributionFrequency =
  | 'annually'
  | 'semiannually'
  | 'quarterly'
  | 'monthly'
  | 'biweekly'
  | 'weekly';

export interface InterestPreset {
  label: string;
  mode: InterestMode;
  principal: string;
  rate: string;
  time: string;
  frequency?: CompoundingFrequency;
  contributions?: string;
  contributionFrequency?: ContributionFrequency;
  targetAmount?: string;
}

export interface InterestModeDefinition {
  id: InterestMode;
  label: string;
  description: string;
  icon: string;
}

export interface FrequencyDefinition {
  id: CompoundingFrequency;
  label: string;
  periodsPerYear: number;
}

export interface ContributionFrequencyDefinition {
  id: ContributionFrequency;
  label: string;
  periodsPerYear: number;
}

export interface TimelinePoint {
  label: string;
  balance: number;
  interest: number;
  contribution: number;
}

export interface TimelineSegment extends TimelinePoint {
  proportion: number;
}

export interface Breakdown {
  totalPrincipal: number;
  totalInterestEarned: number;
  totalContributions: number;
  totalFutureValue: number;
}

export interface GoalProgress {
  targetAmount: number;
  reached: boolean;
  difference: number;
  estimatedTime?: number;
}

export interface InterestCalculationInput {
  mode: InterestMode;
  principal: number;
  rate: number;
  time: number;
  frequency: CompoundingFrequency;
  contributions: number;
  contributionFrequency: ContributionFrequency;
  targetAmount?: number;
  includeTimeline: boolean;
  includeBreakdown: boolean;
}

export interface GrowthComputation {
  futureValue: number;
  interestEarned: number;
  totalContributions: number;
  timeline?: TimelinePoint[];
}

export interface InterestSummary {
  futureValue: number;
  interestEarned: number;
  simpleInterestEquivalent: number;
  compoundGain: number;
  effectiveAnnualRate: number;
  totalContributions: number;
}

export interface InterestResult {
  summary: InterestSummary;
  timeline?: TimelinePoint[];
  breakdown?: Breakdown;
  goalProgress?: GoalProgress;
}

export interface InterestHistory extends InterestResult {
  mode: InterestMode;
  principal: string;
  rate: string;
  time: string;
  frequency: CompoundingFrequency;
  contributions: string;
  contributionFrequency: ContributionFrequency;
  targetAmount: string;
}

export type InterestCalculatorFormGroup = FormGroup<{
  mode: FormControl<InterestMode>;
  principal: FormControl<string | null>;
  rate: FormControl<string | null>;
  time: FormControl<string | null>;
  frequency: FormControl<CompoundingFrequency>;
  contributions: FormControl<string | null>;
  contributionFrequency: FormControl<ContributionFrequency>;
  targetAmount: FormControl<string | null>;
  includeTimeline: FormControl<boolean>;
  includeBreakdown: FormControl<boolean>;
}>;

export interface InterestCalculatorFormValues {
  mode: InterestMode;
  principal: string;
  rate: string;
  time: string;
  frequency: CompoundingFrequency;
  contributions: string;
  contributionFrequency: ContributionFrequency;
  targetAmount: string;
  includeTimeline: boolean;
  includeBreakdown: boolean;
}

export interface InterestSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  mode: InterestMode;
  ratePercent: number;
  timeYears: number;
  contributions: number;
  hasTarget: boolean;
  goalReached: boolean;
  principal: number;
}
