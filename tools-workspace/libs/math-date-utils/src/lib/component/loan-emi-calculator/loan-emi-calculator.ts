import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

type LoanType = 'reducing' | 'flat';
type PaymentFrequencyId = 'monthly' | 'biweekly' | 'weekly';
type ExtraPaymentMode = 'none' | 'monthly' | 'annually';

type PaymentFrequency = {
  id: PaymentFrequencyId;
  label: string;
  periodsPerYear: number;
};

type LoanPreset = {
  label: string;
  amount: string;
  rate: string;
  termYears: string;
  termMonths?: string;
  frequency?: PaymentFrequencyId;
  loanType?: LoanType;
  startDate?: string;
};

type LoanInput = {
  amount: number;
  rate: number;
  termMonths: number;
  frequency: PaymentFrequency;
  loanType: LoanType;
  startDate?: Date;
  extraPayment: number;
  extraMode: ExtraPaymentMode;
};

type LoanSummary = {
  emi: number;
  totalPayments: number;
  totalInterest: number;
  payoffDate?: Date;
  durationMonths: number;
  savingsFromExtra?: number;
  originalInterestWithoutExtra?: number;
};

type ScheduleEntry = {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  extraPayment: number;
  balance: number;
  paymentDate?: Date;
};

type LoanResult = {
  summary: LoanSummary;
  schedulePreview: ScheduleEntry[];
  insights: string[];
};

type LoanHistoryEntry = LoanResult & {
  amount: number;
  rate: number;
  termMonths: number;
  frequency: PaymentFrequencyId;
  loanType: LoanType;
  createdAt: number;
};

const PAYMENT_FREQUENCIES: PaymentFrequency[] = [
  { id: 'monthly', label: 'Monthly (12×)', periodsPerYear: 12 },
  { id: 'biweekly', label: 'Bi-weekly (26×)', periodsPerYear: 26 },
  { id: 'weekly', label: 'Weekly (52×)', periodsPerYear: 52 }
];

const PRESETS: LoanPreset[] = [
  { label: 'Starter home', amount: '350000', rate: '5.1', termYears: '30', startDate: new Date().toISOString().slice(0, 10) },
  { label: 'Car loan', amount: '35000', rate: '6.5', termYears: '5', frequency: 'monthly', loanType: 'reducing' },
  { label: 'Education', amount: '52000', rate: '4.2', termYears: '10', frequency: 'monthly', loanType: 'reducing' },
  { label: 'Personal loan', amount: '15000', rate: '11.5', termYears: '3', frequency: 'monthly', loanType: 'flat' },
  { label: 'Aggressive mortgage', amount: '420000', rate: '5.3', termYears: '25', frequency: 'biweekly', loanType: 'reducing' }
];

const MAX_SCHEDULE_PREVIEW = 24;

@Component({
  selector: 'lib-loan-emi-calculator',
  standalone: true,
  templateUrl: './loan-emi-calculator.html',
  styleUrls: ['./loan-emi-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, DatePipe]
})
export class LoanEmiCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly calculationSub: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly presets = PRESETS;
  readonly frequencies = PAYMENT_FREQUENCIES;

  readonly form: FormGroup = this.fb.group({
    amount: this.fb.control('350000', [Validators.required, numberValidator, Validators.min(1000)]),
    rate: this.fb.control('5.1', [Validators.required, numberValidator, Validators.min(0.1)]),
    termYears: this.fb.control('30', [Validators.required, numberValidator, Validators.min(1)]),
    termMonths: this.fb.control('0', [numberValidator, Validators.min(0)]),
    frequency: this.fb.control<PaymentFrequencyId>('monthly', { nonNullable: true }),
    loanType: this.fb.control<LoanType>('reducing', { nonNullable: true }),
    startDate: this.fb.control<string>(''),
    extraPayment: this.fb.control('0', [numberValidator, Validators.min(0)]),
    extraMode: this.fb.control<ExtraPaymentMode>('none', { nonNullable: true }),
    includeHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<LoanResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<LoanHistoryEntry[]> = signal([]);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly schedulePreview = computed(() => this.result()?.schedulePreview ?? []);
  readonly insights = computed(() => this.result()?.insights ?? []);

  readonly math = Math;

  constructor() {
    this.calculationSub = this.form.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const loanType = this.form.get('loanType')?.value ?? 'reducing';
        const extraMode = this.form.get('extraMode')?.value ?? 'none';
        if (loanType === 'flat' && extraMode !== 'none') {
          this.form.patchValue({ extraMode: 'none', extraPayment: '0' }, { emitEvent: false });
        }
      })
    );

    this.calculate();
  }

  ngOnDestroy(): void {
    this.calculationSub.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  setLoanType(type: LoanType): void {
    if (type === this.form.get('loanType')?.value) {
      return;
    }
    this.form.patchValue({ loanType: type }, { emitEvent: true });
    this.notify(`${type === 'reducing' ? 'Reducing balance' : 'Flat rate'} loan selected.`);
  }

  applyPreset(preset: LoanPreset): void {
    this.form.patchValue(
      {
        amount: preset.amount,
        rate: preset.rate,
        termYears: preset.termYears,
        termMonths: preset.termMonths ?? '0',
        frequency: preset.frequency ?? this.form.get('frequency')?.value ?? 'monthly',
        loanType: preset.loanType ?? this.form.get('loanType')?.value ?? 'reducing',
        startDate: preset.startDate ?? this.form.get('startDate')?.value ?? '',
        extraPayment: '0',
        extraMode: 'none'
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Loan recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  restoreHistory(entry: LoanHistoryEntry): void {
    this.form.patchValue(
      {
        amount: entry.amount.toString(),
        rate: entry.rate.toString(),
        termYears: Math.floor(entry.termMonths / 12).toString(),
        termMonths: (entry.termMonths % 12).toString(),
        frequency: entry.frequency,
        loanType: entry.loanType
      },
      { emitEvent: true }
    );
    this.result.set(entry);
    this.notify('History entry restored.');
  }

  private calculate(): void {
    this.errorMessage.set(null);

    try {
      const input = this.buildInput();
      const calculator = new LoanCalculator();
      const result = calculator.calculate(input);
      this.result.set(result);

      if (this.form.get('includeHistory')?.value) {
        this.pushHistory(result, input);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate EMI.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private buildInput(): LoanInput {
    const amount = toNumber(this.form.get('amount')?.value);
    const rate = toNumber(this.form.get('rate')?.value) / 100;
    const termYears = toNumber(this.form.get('termYears')?.value);
    const termMonthsExtra = toNumber(this.form.get('termMonths')?.value);
    const totalMonths = termYears * 12 + termMonthsExtra;

    if (totalMonths <= 0) {
      throw new Error('Loan tenure must be greater than zero months.');
    }

    const frequency = PAYMENT_FREQUENCIES.find((item) => item.id === (this.form.get('frequency')?.value ?? 'monthly')) ?? PAYMENT_FREQUENCIES[0];
    const loanType = this.form.get('loanType')?.value ?? 'reducing';
    const startDateRaw = this.form.get('startDate')?.value ?? '';
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;
    const extraPayment = toNumber(this.form.get('extraPayment')?.value);
    const extraMode = this.form.get('extraMode')?.value ?? 'none';

    return {
      amount,
      rate,
      termMonths: totalMonths,
      frequency,
      loanType,
      startDate,
      extraPayment,
      extraMode
    };
  }

  private pushHistory(result: LoanResult, input: LoanInput): void {
    const entry: LoanHistoryEntry = {
      ...result,
      amount: input.amount,
      rate: input.rate * 100,
      termMonths: input.termMonths,
      frequency: input.frequency.id,
      loanType: input.loanType,
      createdAt: Date.now()
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.amount === entry.amount && item.rate === entry.rate && item.termMonths === entry.termMonths && item.frequency === entry.frequency && item.loanType === entry.loanType)
      );
      return [entry, ...filtered].slice(0, 8);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3200);
  }

  readonly trackPreset = (_: number, preset: LoanPreset) => preset.label;
  readonly trackFrequency = (_: number, frequency: PaymentFrequency) => frequency.id;
  readonly trackSchedule = (_: number, item: ScheduleEntry) => item.period;
  readonly trackInsight = (_: number, insight: string) => insight;
  readonly trackHistory = (_: number, entry: LoanHistoryEntry) => `${entry.amount}-${entry.rate}-${entry.termMonths}-${entry.frequency}-${entry.loanType}`;

  formatCurrency(value: number): string {
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }
}

class LoanCalculator {
  calculate(input: LoanInput): LoanResult {
    if (input.amount <= 0) {
      throw new Error('Loan amount must be greater than zero.');
    }
    if (input.rate < 0) {
      throw new Error('Interest rate cannot be negative.');
    }

    const summary = input.loanType === 'flat' ? this.calculateFlatLoan(input) : this.calculateReducingLoan(input);
    const insights = buildInsights(summary, input);

    return {
      summary,
      schedulePreview: summary.schedulePreview,
      insights
    };
  }

  private calculateFlatLoan(input: LoanInput): LoanSummary & { schedulePreview: ScheduleEntry[] } {
    const periodsPerYear = input.frequency.periodsPerYear;
    const totalPeriods = input.termMonths / 12 * periodsPerYear;
    const totalInterest = input.amount * input.rate * (input.termMonths / 12);
    const totalPayments = input.amount + totalInterest;
    const emi = totalPayments / totalPeriods;

    const schedulePreview = buildFlatSchedulePreview(input, emi, totalPayments, totalPeriods);

    return {
      emi,
      totalPayments,
      totalInterest,
      payoffDate: computePayoffDate(input.startDate, totalPeriods, input.frequency),
      durationMonths: input.termMonths,
      schedulePreview
    };
  }

  private calculateReducingLoan(input: LoanInput): LoanSummary & { schedulePreview: ScheduleEntry[] } {
    const periodsPerYear = input.frequency.periodsPerYear;
    const periodicRate = input.rate / periodsPerYear;
    const totalPeriods = Math.round((input.termMonths / 12) * periodsPerYear);
    const emi = computeEmi(input.amount, periodicRate, totalPeriods);

    const scheduleData = buildReducingSchedule(input, emi, periodicRate, totalPeriods);

    return {
      emi,
      totalPayments: scheduleData.totalPayment,
      totalInterest: scheduleData.totalInterest,
      payoffDate: scheduleData.payoffDate,
      durationMonths: Math.round((scheduleData.periodsPaid / periodsPerYear) * 12),
      savingsFromExtra: scheduleData.savingsFromExtra,
      originalInterestWithoutExtra: scheduleData.originalInterest,
      schedulePreview: scheduleData.preview
    };
  }
}

function computeEmi(principal: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) {
    return principal / periods;
  }
  const factor = Math.pow(1 + periodicRate, periods);
  return principal * periodicRate * factor / (factor - 1);
}

function buildFlatSchedulePreview(input: LoanInput, emi: number, totalPayments: number, totalPeriods: number): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const interestPortion = totalPayments - input.amount;
  const interestPerPeriod = interestPortion / totalPeriods;
  const principalPerPeriod = input.amount / totalPeriods;

  for (let period = 1; period <= Math.min(totalPeriods, MAX_SCHEDULE_PREVIEW); period++) {
    const balance = Math.max(input.amount - principalPerPeriod * period, 0);
    entries.push({
      period,
      payment: emi,
      principal: principalPerPeriod,
      interest: interestPerPeriod,
      extraPayment: 0,
      balance,
      paymentDate: computePayoffDate(input.startDate, period, input.frequency)
    });
  }

  return entries;
}

function buildReducingSchedule(
  input: LoanInput,
  emi: number,
  periodicRate: number,
  totalPeriods: number
): {
  preview: ScheduleEntry[];
  totalPayment: number;
  totalInterest: number;
  payoffDate?: Date;
  periodsPaid: number;
  savingsFromExtra?: number;
  originalInterest: number;
} {
  let balance = input.amount;
  const preview: ScheduleEntry[] = [];
  let totalPayment = 0;
  let totalInterest = 0;
  let periodsPaid = 0;
  let payoffDate: Date | undefined;

  const extraPerPeriod = computeExtraPerPeriod(input.extraPayment, input.extraMode, input.frequency);

  const originalInterest = input.extraMode === 'none'
    ? 0
    : computeBaselineInterest(input.amount, periodicRate, totalPeriods, emi);

  for (let period = 1; period <= totalPeriods && balance > 0; period++) {
    const interest = balance * periodicRate;
    let principal = emi - interest;
    let extra = extraPerPeriod;

    if (principal < 0) {
      principal = 0;
    }

    if (extra > 0 && balance - principal - extra < 0) {
      extra = Math.max(0, balance - principal);
    }

    const totalPrincipal = principal + extra;
    balance = Math.max(balance - totalPrincipal, 0);

    const payment = principal + interest + extra;
    totalPayment += payment;
    totalInterest += interest;
    periodsPaid = period;

    if (preview.length < MAX_SCHEDULE_PREVIEW) {
      preview.push({
        period,
        payment,
        principal,
        interest,
        extraPayment: extra,
        balance,
        paymentDate: computePayoffDate(input.startDate, period, input.frequency)
      });
    }

    if (balance <= 0) {
      payoffDate = computePayoffDate(input.startDate, period, input.frequency);
      break;
    }
  }

  const savingsFromExtra = input.extraMode === 'none' ? undefined : (originalInterest - totalInterest > 0 ? originalInterest - totalInterest : undefined);

  return {
    preview,
    totalPayment,
    totalInterest,
    payoffDate,
    periodsPaid,
    savingsFromExtra,
    originalInterest
  };
}

function computeExtraPerPeriod(extraPayment: number, extraMode: ExtraPaymentMode, frequency: PaymentFrequency): number {
  if (extraMode === 'none' || extraPayment <= 0) {
    return 0;
  }
  if (extraMode === 'monthly') {
    return extraPayment * (12 / frequency.periodsPerYear);
  }
  if (extraMode === 'annually') {
    return extraPayment / frequency.periodsPerYear;
  }
  return 0;
}

function computeBaselineInterest(principal: number, periodicRate: number, totalPeriods: number, emi: number): number {
  let balance = principal;
  let interestTotal = 0;
  for (let period = 0; period < totalPeriods; period++) {
    const interest = balance * periodicRate;
    const principalPayment = emi - interest;
    balance = Math.max(balance - principalPayment, 0);
    interestTotal += interest;
  }
  return interestTotal;
}

function computePayoffDate(startDate: Date | undefined, periods: number, frequency: PaymentFrequency): Date | undefined {
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return undefined;
  }
  const payoff = new Date(startDate.getTime());
  const months = (periods / frequency.periodsPerYear) * 12;
  payoff.setMonth(payoff.getMonth() + Math.round(months));
  return payoff;
}

function buildInsights(summary: LoanSummary, input: LoanInput): string[] {
  const tips: string[] = [];

  tips.push(`Your periodic payment is ${summary.emi.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}.`);
  tips.push(`Total interest over the loan life is ${summary.totalInterest.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}.`);

  if (summary.payoffDate) {
    tips.push(`Estimated payoff date: ${summary.payoffDate.toLocaleDateString()}.`);
  }

  if (summary.savingsFromExtra) {
    tips.push(`Extra payments save approximately ${summary.savingsFromExtra.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} in interest.`);
  }

  if (input.loanType === 'flat') {
    tips.push('Flat rate loans keep interest and principal portions constant across payments.');
  } else if (input.extraMode !== 'none' && summary.savingsFromExtra) {
    tips.push('Maintain consistent extra payments to accelerate payoff and reduce interest costs.');
  }

  return tips;
}

function numberValidator(control: import('@angular/forms').AbstractControl) {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = toNumber(raw);
  if (!Number.isFinite(value)) {
    return { number: true };
  }
  return null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalised = value.split(',').join('').trim();
  return normalised ? Number.parseFloat(normalised) : 0;
}
