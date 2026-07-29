import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  TIP_HIGH_PERCENT,
  TIP_LARGE_PARTY_COUNT
} from '../constants/tip-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  TipInput,
  TipResult,
  TipSuggestionContext,
  TipSummary
} from '../types/tip-calculator.types';

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

export function formatTipCurrency(value: number, currency: string): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  });
}

export function formatTipPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTipSummaryText(summary: TipSummary, currency: string): string {
  return [
    `Grand total: ${formatTipCurrency(summary.grandTotal, currency)}`,
    `Bill: ${formatTipCurrency(summary.totalBill, currency)}`,
    `Tip: ${formatTipCurrency(summary.totalTip, currency)}`,
    `Tax: ${formatTipCurrency(summary.totalTax, currency)}`,
    ...summary.perPerson.map(
      (amount, index) =>
        `${summary.perPersonLabels[index]}: ${formatTipCurrency(amount, currency)}`
    )
  ].join('\n');
}

export function mapTipCalculationError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to calculate tip.';
}

export function calculateTip(input: TipInput): TipResult {
  const tipAmount = input.amount * (input.tipPercent / 100);
  const taxAmount = input.amount * (input.taxPercent / 100);
  let grandTotal = input.amount + tipAmount + taxAmount;
  let roundingAdjustment = 0;

  if (input.round) {
    const rounded = Math.round(grandTotal * 100) / 100;
    roundingAdjustment = rounded - grandTotal;
    grandTotal = rounded;
  }

  const distribution = distributeTotals(grandTotal, input, roundingAdjustment);

  const summary: TipSummary = {
    totalBill: input.amount,
    totalTip: tipAmount,
    totalTax: taxAmount,
    grandTotal,
    perPerson: distribution.amounts,
    perPersonLabels: distribution.labels,
    roundingAdjustment
  };

  return { summary, tips: buildTips(summary, input) };
}

function distributeTotals(
  grandTotal: number,
  input: TipInput,
  roundingAdjustment: number
): { amounts: number[]; labels: string[] } {
  if (input.splitMode === 'custom' && input.customShares.length > 0) {
    const totalShares = input.customShares.reduce((sum, share) => sum + share, 0);
    const amounts = input.customShares.map((share) => grandTotal * (share / totalShares));
    const labels = input.customShares.map((_, index) => `Guest ${index + 1}`);
    return { amounts, labels };
  }

  const perPerson = grandTotal / input.splitCount;
  const amounts = Array.from(
    { length: input.splitCount },
    (_, index) => perPerson + (index === 0 ? roundingAdjustment : 0)
  );
  const labels = amounts.map((_, index) => `Person ${index + 1}`);
  return { amounts, labels };
}

function buildTips(summary: TipSummary, input: TipInput): string[] {
  const baseTips = [
    `Tip amount: ${formatTipCurrency(summary.totalTip, input.currency)}.`,
    `Grand total: ${formatTipCurrency(summary.grandTotal, input.currency)}.`,
    input.splitMode === 'equal'
      ? `Each person pays ${formatTipCurrency(summary.perPerson[0], input.currency)}.`
      : 'Custom share mode applied; amounts vary per guest.'
  ];

  if (summary.roundingAdjustment !== 0) {
    baseTips.push(
      `Rounded total adjusted by ${formatTipCurrency(summary.roundingAdjustment, input.currency)}.`
    );
  }

  if (input.taxPercent > 0) {
    baseTips.push(
      `Tax contributed ${formatTipCurrency(summary.totalTax, input.currency)} to the total.`
    );
  }

  return baseTips;
}

export function resolveTipSuggestion(context: TipSuggestionContext): MdToolSuggestion | null {
  const {
    hasResult,
    hasError,
    tipPercent,
    taxPercent,
    splitCount,
    splitMode,
    amount,
    currency
  } = context;

  if (hasError) {
    return {
      id: 'tc-validation',
      title: 'Check bill inputs',
      reason:
        'Bill amount cannot be negative, and custom split needs at least one positive share. Percentage Calculator helps verify tip rates.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && splitMode === 'custom') {
    return {
      id: 'tc-custom',
      title: 'Custom shares in use',
      reason:
        'Fraction Calculator can reduce share ratios to lowest terms when explaining uneven splits.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  if (hasResult && splitCount >= TIP_LARGE_PARTY_COUNT) {
    return {
      id: 'tc-party',
      title: 'Large party split',
      reason:
        'With many guests, Number to Words helps list per-person totals on shared expense notes.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && tipPercent >= TIP_HIGH_PERCENT) {
    return {
      id: 'tc-high-tip',
      title: 'Generous tip percentage',
      reason:
        'Percentage Calculator can show how this tip compares to the pre-tax bill for expense reports.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && currency !== 'USD') {
    return {
      id: 'tc-currency',
      title: 'Non-USD currency selected',
      reason:
        'Currency Converter helps when the card charges in a different currency than the menu price.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult && taxPercent > 0) {
    return {
      id: 'tc-tax',
      title: 'Tax included in the total',
      reason:
        'Percentage Calculator can separate tax vs tip shares of the bill for clearer receipts.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && amount >= 100) {
    return {
      id: 'tc-large-bill',
      title: 'Larger bill detected',
      reason:
        'Currency Converter is useful if traveling, and Number to Words helps for corporate expense wording.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult) {
    return {
      id: 'tc-percent',
      title: 'Need a percent breakdown?',
      reason:
        'Percentage Calculator verifies tip and tax rates against the bill before you settle.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  return {
    id: 'tc-start',
    title: 'Enter bill details',
    reason:
      'Set amount, tip, and split mode to see per-person totals. Related tools help with percents, FX, and wording.',
    actionLabel: 'Open Percentage Calculator',
    path: '/math-date-utils/percentage-calculator'
  };
}
