import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  INTEREST_COMPOUND_FREQUENCIES,
  INTEREST_CONTRIBUTION_FREQUENCIES,
  INTEREST_HIGH_RATE_PERCENT,
  INTEREST_LONG_HORIZON_YEARS,
  INTEREST_MODES
} from '../constants/simple-compound-interest-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  CompoundingFrequency,
  ContributionFrequency,
  ContributionFrequencyDefinition,
  FrequencyDefinition,
  GoalProgress,
  GrowthComputation,
  InterestCalculationInput,
  InterestMode,
  InterestResult,
  InterestSuggestionContext,
  InterestSummary,
  TimelinePoint
} from '../types/simple-compound-interest-calculator.types';

export function numberValidator(control: AbstractControl): ValidationErrors | null {
  const rawValue = control.value;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  const numericValue = toNumber(rawValue);
  return Number.isFinite(numericValue) && numericValue >= 0 ? null : { number: true };
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalised = value.split(',').join('').trim();
  if (!normalised) {
    return 0;
  }
  const parsed = Number.parseFloat(normalised);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatInterestCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function formatInterestSummaryText(summary: InterestSummary): string {
  return [
    `Future value: ${formatInterestCurrency(summary.futureValue)}`,
    `Interest earned: ${formatInterestCurrency(summary.interestEarned)}`,
    `Effective annual rate: ${summary.effectiveAnnualRate.toFixed(2)}%`
  ].join('\n');
}

export function resolveInterestModeLabel(mode: InterestMode): string {
  return INTEREST_MODES.find((item) => item.id === mode)?.label ?? mode;
}

export function getCompoundFrequency(id: CompoundingFrequency): FrequencyDefinition {
  return INTEREST_COMPOUND_FREQUENCIES.find((item) => item.id === id) ?? INTEREST_COMPOUND_FREQUENCIES[0];
}

export function getContributionFrequency(
  id: ContributionFrequency
): ContributionFrequencyDefinition {
  return (
    INTEREST_CONTRIBUTION_FREQUENCIES.find((item) => item.id === id) ??
    INTEREST_CONTRIBUTION_FREQUENCIES[0]
  );
}

export function mapInterestCalculationError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to calculate interest.';
}

export function calculateInterest(options: InterestCalculationInput): InterestResult {
  if (options.principal < 0 || options.rate < 0 || options.time < 0) {
    throw new Error('Principal, rate, and time must be non-negative.');
  }

  const { mode, includeTimeline, includeBreakdown, targetAmount } = options;
  const data = mode === 'simple' ? computeSimpleGrowth(options) : computeCompoundGrowth(options);

  const summary: InterestSummary = {
    futureValue: data.futureValue,
    interestEarned: data.interestEarned,
    simpleInterestEquivalent: options.principal * options.rate * options.time,
    compoundGain: data.interestEarned - options.principal * options.rate * options.time,
    effectiveAnnualRate:
      options.time > 0 ? Math.pow(data.futureValue / options.principal, 1 / options.time) - 1 : 0,
    totalContributions: data.totalContributions
  };

  const breakdown = includeBreakdown
    ? {
        totalPrincipal: options.principal,
        totalInterestEarned: data.interestEarned,
        totalContributions: data.totalContributions,
        totalFutureValue: data.futureValue
      }
    : undefined;

  return {
    summary,
    timeline: includeTimeline ? data.timeline : undefined,
    breakdown,
    goalProgress: deriveGoalProgress(targetAmount, data.futureValue, options)
  };
}

export function buildTimelineSegments(
  segments: TimelinePoint[]
): Array<TimelinePoint & { proportion: number }> {
  if (!segments.length) {
    return [];
  }
  const maxValue = Math.max(...segments.map((segment) => segment.balance));
  return segments.map((segment) => ({
    ...segment,
    proportion: maxValue ? Math.min(100, Math.max(2, (segment.balance / maxValue) * 100)) : 0
  }));
}

function computeSimpleGrowth(options: InterestCalculationInput): GrowthComputation {
  const { principal, rate, time, includeTimeline } = options;
  const futureValue = principal * (1 + rate * time);
  const interestEarned = futureValue - principal;
  const timeline = includeTimeline ? buildSimpleTimeline(principal, rate, time) : undefined;

  return {
    futureValue,
    interestEarned,
    totalContributions: 0,
    timeline
  };
}

function computeCompoundGrowth(options: InterestCalculationInput): GrowthComputation {
  const {
    principal,
    rate,
    time,
    frequency,
    contributions,
    contributionFrequency,
    includeTimeline
  } = options;

  const compPeriods = getCompoundFrequency(frequency).periodsPerYear;
  const contributionPeriods = getContributionFrequency(contributionFrequency).periodsPerYear;
  const totalPeriods = time * compPeriods;
  const periodicRate = rate / compPeriods;

  let balance = principal * Math.pow(1 + periodicRate, totalPeriods);
  let totalContributions = 0;

  if (contributions > 0) {
    const contributionRate = rate / contributionPeriods;
    const totalContributionTerms = time * contributionPeriods;
    const contributionFutureValue =
      contributions *
      ((Math.pow(1 + contributionRate, totalContributionTerms) - 1) / contributionRate);
    balance += contributionFutureValue;
    totalContributions = contributions * totalContributionTerms;
  }

  const interestEarned = balance - principal - totalContributions;
  const timeline = includeTimeline
    ? buildCompoundTimeline(principal, periodicRate, totalPeriods, contributions, contributionPeriods)
    : undefined;

  return {
    futureValue: balance,
    interestEarned,
    totalContributions,
    timeline
  };
}

export function buildSimpleTimeline(principal: number, rate: number, time: number): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  const years = Math.ceil(time);
  for (let year = 0; year <= years; year++) {
    const interest = principal * rate * year;
    points.push({
      label: `Year ${year}`,
      balance: principal + interest,
      interest,
      contribution: 0
    });
  }
  return points;
}

export function buildCompoundTimeline(
  principal: number,
  periodicRate: number,
  totalPeriods: number,
  contributions: number,
  contributionPeriods: number
): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  let balance = principal;
  let accruedInterest = 0;
  let totalContributions = 0;

  const periodsPerYear = contributionPeriods;
  const years = Math.ceil(totalPeriods / periodsPerYear);

  points.push({ label: 'Year 0', balance, interest: 0, contribution: 0 });

  for (let year = 1; year <= years; year++) {
    for (let period = 0; period < periodsPerYear; period++) {
      const globalPeriod = (year - 1) * periodsPerYear + period + 1;
      if (globalPeriod > totalPeriods) {
        break;
      }
      if (contributions > 0) {
        balance += contributions;
        totalContributions += contributions;
      }
      balance *= 1 + periodicRate;
    }
    accruedInterest = balance - principal - totalContributions;
    points.push({
      label: `Year ${year}`,
      balance,
      interest: accruedInterest,
      contribution: totalContributions
    });
  }

  return points;
}

export function estimateTimeForGoal(
  principal: number,
  rate: number,
  target: number
): number | undefined {
  if (principal <= 0 || rate <= 0 || target <= principal) {
    return undefined;
  }
  return Math.log(target / principal) / Math.log(1 + rate);
}

function deriveGoalProgress(
  target: number | undefined,
  futureValue: number,
  options: InterestCalculationInput
): GoalProgress | undefined {
  if (!target || target <= 0) {
    return undefined;
  }

  const reached = futureValue >= target;
  let estimatedTime: number | undefined;

  if (!reached) {
    if (options.mode === 'compound') {
      estimatedTime = estimateTimeForGoal(options.principal, options.rate, target);
    } else if (options.principal > 0 && options.rate > 0) {
      estimatedTime = (target - options.principal) / (options.principal * options.rate);
    }
  }

  return {
    targetAmount: target,
    reached,
    difference: futureValue - target,
    estimatedTime
  };
}

export function resolveInterestSuggestion(
  context: InterestSuggestionContext
): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    mode,
    ratePercent,
    timeYears,
    contributions,
    hasTarget,
    goalReached,
    principal
  } = context;

  if (hasError) {
    return {
      id: 'sic-validation',
      title: 'Check interest inputs',
      reason:
        'Principal, rate, and time must be non-negative numbers. Percentage Calculator helps when you only know a growth percent.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && mode === 'simple') {
    return {
      id: 'sic-simple',
      title: 'Simple interest selected',
      reason:
        'Simple interest ignores compounding. Loan EMI Calculator models payment schedules when this rate is for a loan.',
      actionLabel: 'Open Loan EMI Calculator',
      path: '/math-date-utils/loan-emi-calculator'
    };
  }

  if (hasResult && contributions > 0) {
    return {
      id: 'sic-contributions',
      title: 'Recurring contributions detected',
      reason:
        'You are modeling ongoing deposits. Number to Words helps spell out the projected balance for plans or statements.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && hasTarget && goalReached) {
    return {
      id: 'sic-goal-met',
      title: 'Target amount reached',
      reason:
        'Your projection meets the goal. Currency Converter helps if the target is in another currency.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult && timeYears >= INTEREST_LONG_HORIZON_YEARS) {
    return {
      id: 'sic-long-horizon',
      title: 'Long investment horizon',
      reason:
        'Over long spans, Loan EMI Calculator is useful if part of the plan involves borrowing against growth.',
      actionLabel: 'Open Loan EMI Calculator',
      path: '/math-date-utils/loan-emi-calculator'
    };
  }

  if (hasResult && ratePercent >= INTEREST_HIGH_RATE_PERCENT) {
    return {
      id: 'sic-high-rate',
      title: 'High annual rate detected',
      reason:
        'Double-digit rates grow quickly—and can signal loan costs. Compare payment impact in Loan EMI Calculator.',
      actionLabel: 'Open Loan EMI Calculator',
      path: '/math-date-utils/loan-emi-calculator'
    };
  }

  if (hasResult && principal >= 10000) {
    return {
      id: 'sic-currency',
      title: 'Large principal amount',
      reason:
        'Currency Converter helps when principal or future value needs FX adjustment before planning.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'sic-percent',
      title: 'Compare growth as a percent',
      reason:
        'Percentage Calculator can express the gain relative to principal for reports and slides.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  return {
    id: 'sic-start',
    title: 'Enter principal, rate, and time',
    reason:
      'Compare simple vs compound growth, add contributions, and set goals. Related tools help with EMI, FX, and wording.',
    actionLabel: 'Open Loan EMI Calculator',
    path: '/math-date-utils/loan-emi-calculator'
  };
}
