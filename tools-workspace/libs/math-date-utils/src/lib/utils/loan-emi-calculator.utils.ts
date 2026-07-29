import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  LOAN_EMI_HIGH_RATE_PERCENT,
  LOAN_EMI_LONG_TERM_MONTHS,
  LOAN_EMI_MAX_SCHEDULE_PREVIEW,
  LOAN_EMI_PAYMENT_FREQUENCIES
} from '../constants/loan-emi-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  ExtraPaymentMode,
  LoanEmiSuggestionContext,
  LoanInput,
  LoanResult,
  LoanSummary,
  LoanType,
  PaymentFrequency,
  PaymentFrequencyId,
  ScheduleEntry
} from '../types/loan-emi-calculator.types';

export function numberValidator(control: AbstractControl): ValidationErrors | null {
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

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalised = value.split(',').join('').trim();
  return normalised ? Number.parseFloat(normalised) : 0;
}

export function formatLoanCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function formatLoanPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatLoanSummaryText(summary: LoanSummary): string {
  return [
    `EMI: ${formatLoanCurrency(summary.emi)}`,
    `Total payment: ${formatLoanCurrency(summary.totalPayments)}`,
    `Total interest: ${formatLoanCurrency(summary.totalInterest)}`,
    `Duration: ${summary.durationMonths} months`
  ].join('\n');
}

export function resolvePaymentFrequency(id: PaymentFrequencyId | null | undefined): PaymentFrequency {
  return (
    LOAN_EMI_PAYMENT_FREQUENCIES.find((item) => item.id === (id ?? 'monthly')) ??
    LOAN_EMI_PAYMENT_FREQUENCIES[0]
  );
}

export function calculateLoanEmi(input: LoanInput): LoanResult {
  if (input.amount <= 0) {
    throw new Error('Loan amount must be greater than zero.');
  }
  if (input.rate < 0) {
    throw new Error('Interest rate cannot be negative.');
  }

  const computed =
    input.loanType === 'flat' ? calculateFlatLoan(input) : calculateReducingLoan(input);
  const { schedulePreview, ...summary } = computed;
  const insights = buildLoanInsights(summary, input);

  return {
    summary,
    schedulePreview,
    insights
  };
}

function calculateFlatLoan(input: LoanInput): LoanSummary & { schedulePreview: ScheduleEntry[] } {
  const periodsPerYear = input.frequency.periodsPerYear;
  const totalPeriods = (input.termMonths / 12) * periodsPerYear;
  const totalInterest = input.amount * input.rate * (input.termMonths / 12);
  const totalPayments = input.amount + totalInterest;
  const emi = totalPayments / totalPeriods;

  return {
    emi,
    totalPayments,
    totalInterest,
    payoffDate: computePayoffDate(input.startDate, totalPeriods, input.frequency),
    durationMonths: input.termMonths,
    schedulePreview: buildFlatSchedulePreview(input, emi, totalPayments, totalPeriods)
  };
}

function calculateReducingLoan(
  input: LoanInput
): LoanSummary & { schedulePreview: ScheduleEntry[] } {
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

export function computeEmi(principal: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) {
    return principal / periods;
  }
  const factor = Math.pow(1 + periodicRate, periods);
  return (principal * periodicRate * factor) / (factor - 1);
}

function buildFlatSchedulePreview(
  input: LoanInput,
  emi: number,
  totalPayments: number,
  totalPeriods: number
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const interestPortion = totalPayments - input.amount;
  const interestPerPeriod = interestPortion / totalPeriods;
  const principalPerPeriod = input.amount / totalPeriods;

  for (let period = 1; period <= Math.min(totalPeriods, LOAN_EMI_MAX_SCHEDULE_PREVIEW); period++) {
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

  const extraPerPeriod = computeExtraPerPeriod(
    input.extraPayment,
    input.extraMode,
    input.frequency
  );

  const originalInterest =
    input.extraMode === 'none'
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

    if (preview.length < LOAN_EMI_MAX_SCHEDULE_PREVIEW) {
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

  const savingsFromExtra =
    input.extraMode === 'none'
      ? undefined
      : originalInterest - totalInterest > 0
        ? originalInterest - totalInterest
        : undefined;

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

export function computeExtraPerPeriod(
  extraPayment: number,
  extraMode: ExtraPaymentMode,
  frequency: PaymentFrequency
): number {
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

function computeBaselineInterest(
  principal: number,
  periodicRate: number,
  totalPeriods: number,
  emi: number
): number {
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

export function computePayoffDate(
  startDate: Date | undefined,
  periods: number,
  frequency: PaymentFrequency
): Date | undefined {
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return undefined;
  }
  const payoff = new Date(startDate.getTime());
  const months = (periods / frequency.periodsPerYear) * 12;
  payoff.setMonth(payoff.getMonth() + Math.round(months));
  return payoff;
}

export function buildLoanInsights(summary: LoanSummary, input: LoanInput): string[] {
  const tips: string[] = [];

  tips.push(`Your periodic payment is ${formatLoanCurrency(summary.emi)}.`);
  tips.push(
    `Total interest over the loan life is ${formatLoanCurrency(summary.totalInterest)}.`
  );

  if (summary.payoffDate) {
    tips.push(`Estimated payoff date: ${summary.payoffDate.toLocaleDateString()}.`);
  }

  if (summary.savingsFromExtra) {
    tips.push(
      `Extra payments save approximately ${formatLoanCurrency(summary.savingsFromExtra)} in interest.`
    );
  }

  if (input.loanType === 'flat') {
    tips.push('Flat rate loans keep interest and principal portions constant across payments.');
  } else if (input.extraMode !== 'none' && summary.savingsFromExtra) {
    tips.push('Maintain consistent extra payments to accelerate payoff and reduce interest costs.');
  }

  return tips;
}

export function mapLoanCalculationError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to calculate EMI.';
}

export function loanTypeLabel(type: LoanType): string {
  return type === 'reducing' ? 'Reducing balance' : 'Flat rate';
}

export function resolveLoanEmiSuggestion(
  context: LoanEmiSuggestionContext
): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    loanType,
    ratePercent,
    termMonths,
    amount,
    frequency,
    hasExtraPayments,
    hasInterestSavings
  } = context;

  if (hasError) {
    return {
      id: 'lec-validation',
      title: 'Check loan inputs',
      reason:
        'Amount, rate, and tenure must be valid numbers with a positive term. Percentage Calculator helps when you only know a share of the price.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && loanType === 'flat') {
    return {
      id: 'lec-flat',
      title: 'Flat rate vs reducing balance',
      reason:
        'Flat-rate loans often quote higher effective cost. Compare growth scenarios in Simple & Compound Interest before committing.',
      actionLabel: 'Open Interest Calculator',
      path: '/math-date-utils/simple-compound-interest-calculator'
    };
  }

  if (hasResult && ratePercent >= LOAN_EMI_HIGH_RATE_PERCENT) {
    return {
      id: 'lec-high-rate',
      title: 'High interest rate detected',
      reason:
        'At double-digit rates, interest dominates. Model simpler rate scenarios or compare compounding in the interest calculator.',
      actionLabel: 'Open Interest Calculator',
      path: '/math-date-utils/simple-compound-interest-calculator'
    };
  }

  if (hasResult && hasExtraPayments && hasInterestSavings) {
    return {
      id: 'lec-extra-savings',
      title: 'Extra payments are reducing interest',
      reason:
        'You are ahead of the baseline schedule. Tip Calculator can help allocate leftover monthly cash toward further extras.',
      actionLabel: 'Open Tip Calculator',
      path: '/math-date-utils/tip-calculator'
    };
  }

  if (hasResult && termMonths >= LOAN_EMI_LONG_TERM_MONTHS && frequency === 'monthly') {
    return {
      id: 'lec-long-term',
      title: 'Long tenure on monthly payments',
      reason:
        'Switching frequency to bi-weekly in this tool can shorten payoff. Interest Calculator helps compare total cost at different rates.',
      actionLabel: 'Open Interest Calculator',
      path: '/math-date-utils/simple-compound-interest-calculator'
    };
  }

  if (hasResult && amount >= 100000) {
    return {
      id: 'lec-currency',
      title: 'Large loan amount',
      reason:
        'Currency Converter helps when the principal or EMI is in a foreign currency or you need FX-adjusted totals.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'lec-interest',
      title: 'Compare interest strategies',
      reason:
        'Simple & Compound Interest Calculator models lump-sum growth without amortization—useful alongside this EMI schedule.',
      actionLabel: 'Open Interest Calculator',
      path: '/math-date-utils/simple-compound-interest-calculator'
    };
  }

  return {
    id: 'lec-start',
    title: 'Enter loan details',
    reason:
      'Set amount, rate, and tenure to see EMI, interest, and payoff. Related tools help with percentages, FX, and interest comparisons.',
    actionLabel: 'Open Interest Calculator',
    path: '/math-date-utils/simple-compound-interest-calculator'
  };
}
