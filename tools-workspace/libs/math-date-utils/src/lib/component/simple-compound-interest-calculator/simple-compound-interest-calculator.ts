import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

@Component({
  selector: 'lib-simple-compound-interest-calculator',
  standalone: true,
  templateUrl: './simple-compound-interest-calculator.html',
  styleUrls: ['./simple-compound-interest-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation]
})
export class SimpleCompoundInterestCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly calculationSubscription: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly modes = INTEREST_MODES;
  readonly compoundingFrequencies = COMPOUND_FREQUENCIES;
  readonly contributionFrequencyOptions = CONTRIBUTION_FREQUENCIES;
  readonly presets = INTEREST_PRESETS;

  readonly form = this.fb.group({
    mode: this.fb.control<InterestMode>('compound', { nonNullable: true }),
    principal: this.fb.control('10000', [Validators.required, numberValidator]),
    rate: this.fb.control('7.5', [Validators.required, numberValidator]),
    time: this.fb.control('5', [Validators.required, numberValidator]),
    frequency: this.fb.control<CompoundingFrequency>('annually', { nonNullable: true }),
    contributions: this.fb.control('0', [numberValidator]),
    contributionFrequency: this.fb.control<ContributionFrequency>('monthly', { nonNullable: true }),
    targetAmount: this.fb.control('', [numberValidator]),
    includeTimeline: this.fb.control(true, { nonNullable: true }),
    includeBreakdown: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<InterestResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<InterestHistory[]> = signal([]);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly timeline = computed(() => this.result()?.timeline ?? []);
  readonly breakdown = computed(() => this.result()?.breakdown ?? null);
  readonly goals = computed(() => this.result()?.goalProgress ?? null);

  readonly timelineSegments = computed(() => {
    const segments = this.timeline();
    if (!segments.length) {
      return [];
    }
    const maxValue = Math.max(...segments.map((segment) => segment.balance));
    return segments.map((segment) => ({
      ...segment,
      proportion: maxValue ? Math.min(100, Math.max(2, (segment.balance / maxValue) * 100)) : 0
    }));
  });

  constructor() {
    this.calculationSubscription = this.form.valueChanges
      .pipe(debounceTime(80), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const mode = this.form.get('mode')?.value ?? 'compound';
        if (mode === 'simple') {
          this.form.patchValue({ contributions: '0' }, { emitEvent: false });
        }
      })
    );

    this.calculate();
  }

  ngOnDestroy(): void {
    this.calculationSubscription.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  setMode(mode: InterestMode): void {
    if (mode === this.form.get('mode')?.value) {
      return;
    }
    this.form.patchValue({ mode }, { emitEvent: true });
    this.notify(`${INTEREST_MODES.find((item) => item.id === mode)?.label ?? mode} mode selected.`);
  }

  applyPreset(preset: InterestPreset): void {
    this.form.patchValue(
      {
        mode: preset.mode,
        principal: preset.principal,
        rate: preset.rate,
        time: preset.time,
        frequency: preset.frequency ?? this.form.get('frequency')?.value ?? 'annually',
        contributions: preset.contributions ?? this.form.get('contributions')?.value ?? '0',
        contributionFrequency: preset.contributionFrequency ?? this.form.get('contributionFrequency')?.value ?? 'monthly',
        targetAmount: preset.targetAmount ?? this.form.get('targetAmount')?.value ?? ''
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Interest recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  restoreHistory(entry: InterestHistory): void {
    this.form.patchValue(
      {
        mode: entry.mode,
        principal: entry.principal,
        rate: entry.rate,
        time: entry.time,
        frequency: entry.frequency,
        contributions: entry.contributions,
        contributionFrequency: entry.contributionFrequency,
        targetAmount: entry.targetAmount ?? ''
      },
      { emitEvent: true }
    );
    this.notify('History entry restored.');
  }

  private calculate(): void {
    this.errorMessage.set(null);

    try {
      const input: InterestCalculationInput = {
        mode: this.form.get('mode')?.value ?? 'compound',
        principal: toNumber(this.form.get('principal')?.value),
        rate: toNumber(this.form.get('rate')?.value) / 100,
        time: toNumber(this.form.get('time')?.value),
        frequency: this.form.get('frequency')?.value ?? 'annually',
        contributions: toNumber(this.form.get('contributions')?.value),
        contributionFrequency: this.form.get('contributionFrequency')?.value ?? 'monthly',
        targetAmount: this.form.get('targetAmount')?.value ? toNumber(this.form.get('targetAmount')?.value) : undefined,
        includeTimeline: this.form.get('includeTimeline')?.value ?? true,
        includeBreakdown: this.form.get('includeBreakdown')?.value ?? true
      };

      const calculator = new InterestCalculator();
      const result = calculator.calculate(input);

      this.result.set(result);
      this.pushHistory(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate interest.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(result: InterestResult): void {
    const historyEntry: InterestHistory = {
      ...result,
      mode: this.form.get('mode')?.value ?? 'compound',
      principal: (this.form.get('principal')?.value ?? '0').toString(),
      rate: (this.form.get('rate')?.value ?? '0').toString(),
      time: (this.form.get('time')?.value ?? '0').toString(),
      frequency: this.form.get('frequency')?.value ?? 'annually',
      contributions: (this.form.get('contributions')?.value ?? '0').toString(),
      contributionFrequency: this.form.get('contributionFrequency')?.value ?? 'monthly',
      targetAmount: (this.form.get('targetAmount')?.value ?? '').toString()
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.principal === historyEntry.principal && item.rate === historyEntry.rate && item.time === historyEntry.time && item.mode === historyEntry.mode)
      );
      return [historyEntry, ...filtered].slice(0, 8);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3000);
  }

  readonly trackMode = (_: number, mode: InterestModeDefinition) => mode.id;
  readonly trackFrequency = (_: number, frequency: FrequencyDefinition) => frequency.id;
  readonly trackPreset = (_: number, preset: InterestPreset) => preset.label;
  readonly trackTimeline = (_: number, point: TimelinePoint) => point.label;
  readonly trackHistory = (_: number, entry: InterestHistory) => `${entry.mode}-${entry.principal}-${entry.rate}-${entry.time}`;
  readonly trackFrequencyOption = (_: number, option: FrequencyDefinition) => option.id;
  readonly trackContributionOption = (_: number, option: ContributionFrequencyDefinition) => option.id;

  formatCurrency(value: number): string {
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }
}

type InterestMode = 'simple' | 'compound';
type CompoundingFrequency = 'annually' | 'semiannually' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
type ContributionFrequency = 'annually' | 'semiannually' | 'quarterly' | 'monthly' | 'biweekly' | 'weekly';

type InterestPreset = {
  label: string;
  mode: InterestMode;
  principal: string;
  rate: string;
  time: string;
  frequency?: CompoundingFrequency;
  contributions?: string;
  contributionFrequency?: ContributionFrequency;
  targetAmount?: string;
};

type InterestModeDefinition = {
  id: InterestMode;
  label: string;
  description: string;
  icon: string;
};

type FrequencyDefinition = {
  id: CompoundingFrequency;
  label: string;
  periodsPerYear: number;
};

type ContributionFrequencyDefinition = {
  id: ContributionFrequency;
  label: string;
  periodsPerYear: number;
};

interface TimelinePoint {
  label: string;
  balance: number;
  interest: number;
  contribution: number;
};

type Breakdown = {
  totalPrincipal: number;
  totalInterestEarned: number;
  totalContributions: number;
  totalFutureValue: number;
};

type GoalProgress = {
  targetAmount: number;
  reached: boolean;
  difference: number;
  estimatedTime?: number;
};

interface InterestCalculationInput {
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

interface GrowthComputation {
  futureValue: number;
  interestEarned: number;
  totalContributions: number;
  timeline?: TimelinePoint[];
}

type InterestResult = {
  summary: InterestSummary;
  timeline?: TimelinePoint[];
  breakdown?: Breakdown;
  goalProgress?: GoalProgress;
};

type InterestSummary = {
  futureValue: number;
  interestEarned: number;
  simpleInterestEquivalent: number;
  compoundGain: number;
  effectiveAnnualRate: number;
  totalContributions: number;
};

interface InterestHistory extends InterestResult {
  mode: InterestMode;
  principal: string;
  rate: string;
  time: string;
  frequency: CompoundingFrequency;
  contributions: string;
  contributionFrequency: ContributionFrequency;
  targetAmount: string;
}

const INTEREST_MODES: InterestModeDefinition[] = [
  {
    id: 'compound',
    label: 'Compound growth',
    description: 'Earnings reinvested at each compounding period.',
    icon: '📈'
  },
  {
    id: 'simple',
    label: 'Simple interest',
    description: 'Interest applied to the original principal only.',
    icon: '🧮'
  }
];

const COMPOUND_FREQUENCIES: FrequencyDefinition[] = [
  { id: 'annually', label: 'Annually (1×)', periodsPerYear: 1 },
  { id: 'semiannually', label: 'Semi-annually (2×)', periodsPerYear: 2 },
  { id: 'quarterly', label: 'Quarterly (4×)', periodsPerYear: 4 },
  { id: 'monthly', label: 'Monthly (12×)', periodsPerYear: 12 },
  { id: 'weekly', label: 'Weekly (52×)', periodsPerYear: 52 },
  { id: 'daily', label: 'Daily (365×)', periodsPerYear: 365 }
];

const CONTRIBUTION_FREQUENCIES: ContributionFrequencyDefinition[] = [
  { id: 'annually', label: 'Annually', periodsPerYear: 1 },
  { id: 'semiannually', label: 'Semi-annually', periodsPerYear: 2 },
  { id: 'quarterly', label: 'Quarterly', periodsPerYear: 4 },
  { id: 'monthly', label: 'Monthly', periodsPerYear: 12 },
  { id: 'biweekly', label: 'Bi-weekly', periodsPerYear: 26 },
  { id: 'weekly', label: 'Weekly', periodsPerYear: 52 }
];

const INTEREST_PRESETS: InterestPreset[] = [
  {
    label: 'Retirement (compound)',
    mode: 'compound',
    principal: '25000',
    rate: '6.5',
    time: '25',
    frequency: 'monthly',
    contributions: '500',
    contributionFrequency: 'monthly',
    targetAmount: '500000'
  },
  {
    label: 'Certificate of deposit',
    mode: 'compound',
    principal: '15000',
    rate: '4.1',
    time: '3',
    frequency: 'quarterly'
  },
  {
    label: 'Loan (simple)',
    mode: 'simple',
    principal: '12000',
    rate: '5.9',
    time: '2',
    contributions: '0'
  },
  {
    label: 'College savings',
    mode: 'compound',
    principal: '8000',
    rate: '7',
    time: '18',
    frequency: 'monthly',
    contributions: '200',
    contributionFrequency: 'monthly',
    targetAmount: '100000'
  },
  {
    label: 'Short-term simple',
    mode: 'simple',
    principal: '5000',
    rate: '4',
    time: '1.5'
  }
];

class InterestCalculator {
  calculate(options: InterestCalculationInput): InterestResult {
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
      effectiveAnnualRate: options.time > 0 ? Math.pow(data.futureValue / options.principal, 1 / options.time) - 1 : 0,
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

    const goalProgress = deriveGoalProgress(targetAmount, data.futureValue, options);

    return {
      summary,
      timeline: includeTimeline ? data.timeline : undefined,
      breakdown,
      goalProgress
    };
  }
}

function buildSimpleTimeline(principal: number, rate: number, time: number): TimelinePoint[] {
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

function buildCompoundTimeline(
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
    points.push({ label: `Year ${year}`, balance, interest: accruedInterest, contribution: totalContributions });
  }

  return points;
}

function estimateTimeForGoal(principal: number, rate: number, target: number): number | undefined {
  if (principal <= 0 || rate <= 0 || target <= principal) {
    return undefined;
  }
  return Math.log(target / principal) / Math.log(1 + rate);
}

function getFrequency(id: CompoundingFrequency): FrequencyDefinition {
  return COMPOUND_FREQUENCIES.find((f) => f.id === id) ?? COMPOUND_FREQUENCIES[0];
}

function getContributionFrequency(id: ContributionFrequency): ContributionFrequencyDefinition {
  return CONTRIBUTION_FREQUENCIES.find((f) => f.id === id) ?? CONTRIBUTION_FREQUENCIES[0];
}

function toNumber(value: string | number | null | undefined): number {
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

function numberValidator(control: import('@angular/forms').AbstractControl) {
  const rawValue = control.value;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }
  const numericValue = toNumber(rawValue);
  return Number.isFinite(numericValue) && numericValue >= 0 ? null : { number: true };
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

  const compPeriods = getFrequency(frequency).periodsPerYear;
  const contributionPeriods = getContributionFrequency(contributionFrequency).periodsPerYear;
  const totalPeriods = time * compPeriods;
  const periodicRate = rate / compPeriods;

  let balance = principal * Math.pow(1 + periodicRate, totalPeriods);
  let totalContributions = 0;

  if (contributions > 0) {
    const contributionRate = rate / contributionPeriods;
    const totalContributionTerms = time * contributionPeriods;
    const contributionFutureValue = contributions * ((Math.pow(1 + contributionRate, totalContributionTerms) - 1) / contributionRate);
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

function deriveGoalProgress(target: number | undefined, futureValue: number, options: InterestCalculationInput): GoalProgress | undefined {
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
