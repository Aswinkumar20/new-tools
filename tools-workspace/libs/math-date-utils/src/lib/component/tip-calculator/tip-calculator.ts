import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

type SplitMode = 'equal' | 'custom';

type TipPreset = {
  label: string;
  amount: string;
  tipPercent: string;
  taxPercent?: string;
  splitCount?: string;
};

type TipInput = {
  amount: number;
  tipPercent: number;
  taxPercent: number;
  splitMode: SplitMode;
  splitCount: number;
  round: boolean;
  customShares: number[];
  currency: string;
};

type TipSummary = {
  totalBill: number;
  totalTip: number;
  totalTax: number;
  grandTotal: number;
  perPerson: number[];
  perPersonLabels: string[];
  roundingAdjustment: number;
};

type TipResult = {
  summary: TipSummary;
  tips: string[];
};

type TipHistoryEntry = TipResult & {
  amount: number;
  tipPercent: number;
  taxPercent: number;
  splitCount: number;
  timestamp: number;
};

const PRESETS: TipPreset[] = [
  { label: 'Coffee break', amount: '18.50', tipPercent: '15', splitCount: '1' },
  { label: 'Casual dinner', amount: '86.40', tipPercent: '18', taxPercent: '8.5', splitCount: '2' },
  { label: 'Gourmet night', amount: '245.00', tipPercent: '20', taxPercent: '10', splitCount: '4' },
  { label: 'Large party', amount: '620.00', tipPercent: '18', taxPercent: '9', splitCount: '8' },
  { label: 'Takeout', amount: '42.00', tipPercent: '12', taxPercent: '0', splitCount: '1' }
];

const DEFAULT_CUSTOM_SHARES = Array.from({ length: 4 }, () => 1);

@Component({
  selector: 'lib-tip-calculator',
  standalone: true,
  templateUrl: './tip-calculator.html',
  styleUrls: ['./tip-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective]
})
export class TipCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly calculationSub: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly presets = PRESETS;

  readonly form: FormGroup = this.fb.group({
    amount: this.fb.control('86.40', [Validators.required, numberValidator, Validators.min(0)]),
    tipPercent: this.fb.control('18', [Validators.required, numberValidator, Validators.min(0)]),
    taxPercent: this.fb.control('8.5', [numberValidator, Validators.min(0)]),
    splitMode: this.fb.control<SplitMode>('equal', { nonNullable: true }),
    splitCount: this.fb.control('2', [numberValidator, Validators.min(1)]),
    customShares: this.fb.control(DEFAULT_CUSTOM_SHARES.map((share) => share.toString())),
    round: this.fb.control(true, { nonNullable: true }),
    currency: this.fb.control('USD', [Validators.required]),
    includeHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<TipResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<TipHistoryEntry[]> = signal([]);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly tips = computed(() => this.result()?.tips ?? []);
  readonly splitMode = computed(() => this.form.get('splitMode')?.value ?? 'equal');

  readonly math = Math;

  constructor() {
    this.calculationSub = this.form.valueChanges
      .pipe(debounceTime(80), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const mode = this.form.get('splitMode')?.value ?? 'equal';
        if (mode === 'custom' && (this.form.get('customShares')?.value as string[]).some((share) => toNumber(share) <= 0)) {
          this.form.patchValue({ customShares: DEFAULT_CUSTOM_SHARES.map((share) => share.toString()) }, { emitEvent: false });
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

  setSplitMode(mode: SplitMode): void {
    if (mode === this.form.get('splitMode')?.value) {
      return;
    }
    this.form.patchValue({ splitMode: mode }, { emitEvent: true });
    this.notify(`${mode === 'equal' ? 'Equal split' : 'Custom shares'} enabled.`);
  }

  applyPreset(preset: TipPreset): void {
    this.form.patchValue(
      {
        amount: preset.amount,
        tipPercent: preset.tipPercent,
        taxPercent: preset.taxPercent ?? this.form.get('taxPercent')?.value ?? '0',
        splitCount: preset.splitCount ?? this.form.get('splitCount')?.value ?? '1',
        splitMode: 'equal'
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Tip recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  copyResult(): void {
    const s = this.summary();
    if (!s) return;
    const lines = [
      `Grand total: ${this.formatCurrency(s.grandTotal)}`,
      `Bill: ${this.formatCurrency(s.totalBill)}`,
      `Tip: ${this.formatCurrency(s.totalTip)}`,
      `Tax: ${this.formatCurrency(s.totalTax)}`,
      ...s.perPerson.map((amt, i) => `${s.perPersonLabels[i]}: ${this.formatCurrency(amt)}`),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => this.notify('Result copied to clipboard.'));
  }

  restoreHistory(entry: TipHistoryEntry): void {
    this.form.patchValue(
      {
        amount: entry.amount.toString(),
        tipPercent: entry.tipPercent.toString(),
        taxPercent: entry.taxPercent.toString(),
        splitCount: entry.summary.perPerson.length.toString(),
        splitMode: 'equal'
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
      const calculator = new TipCalculator();
      const result = calculator.calculate(input);
      this.result.set(result);

      if (this.form.get('includeHistory')?.value) {
        this.pushHistory(result, input);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate tip.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private buildInput(): TipInput {
    const amount = toNumber(this.form.get('amount')?.value);
    const tipPercent = toNumber(this.form.get('tipPercent')?.value);
    const taxPercent = toNumber(this.form.get('taxPercent')?.value);
    const splitMode = this.form.get('splitMode')?.value ?? 'equal';
    const splitCount = Math.max(1, Math.floor(toNumber(this.form.get('splitCount')?.value)));
    const round = this.form.get('round')?.value ?? false;
    const currency = (this.form.get('currency')?.value ?? 'USD').toString();

    const customSharesRaw = this.form.get('customShares')?.value as string[];
    const customShares = (customSharesRaw ?? []).map((value) => toNumber(value)).filter((share) => share > 0);

    if (amount < 0) {
      throw new Error('Bill amount cannot be negative.');
    }

    if (splitMode === 'custom' && customShares.length === 0) {
      throw new Error('Provide at least one custom share value.');
    }

    return {
      amount,
      tipPercent,
      taxPercent,
      splitMode,
      splitCount,
      round,
      customShares,
      currency
    };
  }

  private pushHistory(result: TipResult, input: TipInput): void {
    const entry: TipHistoryEntry = {
      ...result,
      amount: input.amount,
      tipPercent: input.tipPercent,
      taxPercent: input.taxPercent,
      splitCount: input.splitMode === 'custom' ? result.summary.perPerson.length : input.splitCount,
      timestamp: Date.now()
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.amount === entry.amount && item.tipPercent === entry.tipPercent && item.taxPercent === entry.taxPercent && item.splitCount === entry.splitCount)
      );
      return [entry, ...filtered].slice(0, 8);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3000);
  }

  readonly trackPreset = (_: number, preset: TipPreset) => preset.label;
  readonly trackTip = (_: number, tip: string) => tip;
  readonly trackHistory = (_: number, entry: TipHistoryEntry) => `${entry.amount}-${entry.tipPercent}-${entry.taxPercent}-${entry.splitCount}`;

  formatCurrency(value: number): string {
    return value.toLocaleString(undefined, { style: 'currency', currency: this.form.get('currency')?.value ?? 'USD', minimumFractionDigits: 2 });
  }

  formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  onCustomShareInput(event: Event, index: number): void {
    const target = event.target as HTMLInputElement;
    const value = toNumber(target.value);
    const shares = [...((this.form.get('customShares')?.value as string[]) ?? [])];
    shares[index] = value > 0 ? value.toString() : '1';
    this.form.patchValue({ customShares: shares }, { emitEvent: true });
  }
}

class TipCalculator {
  calculate(input: TipInput): TipResult {
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

    const tips = buildTips(summary, input);

    return { summary, tips };
  }
}

function distributeTotals(grandTotal: number, input: TipInput, roundingAdjustment: number): { amounts: number[]; labels: string[] } {
  if (input.splitMode === 'custom' && input.customShares.length > 0) {
    const totalShares = input.customShares.reduce((sum, share) => sum + share, 0);
    const amounts = input.customShares.map((share) => grandTotal * (share / totalShares));
    const labels = input.customShares.map((_, index) => `Guest ${index + 1}`);
    return { amounts, labels };
  }

  const perPerson = grandTotal / input.splitCount;
  const amounts = Array.from({ length: input.splitCount }, (_, index) => perPerson + (index === 0 ? roundingAdjustment : 0));
  const labels = amounts.map((_, index) => `Person ${index + 1}`);
  return { amounts, labels };
}

function buildTips(summary: TipSummary, input: TipInput): string[] {
  const baseTips = [
    `Tip amount: ${summary.totalTip.toLocaleString(undefined, { style: 'currency', currency: input.currency })}.`,
    `Grand total: ${summary.grandTotal.toLocaleString(undefined, { style: 'currency', currency: input.currency })}.`,
    input.splitMode === 'equal'
      ? `Each person pays ${summary.perPerson[0].toLocaleString(undefined, { style: 'currency', currency: input.currency })}.`
      : 'Custom share mode applied; amounts vary per guest.'
  ];

  if (summary.roundingAdjustment !== 0) {
    baseTips.push(`Rounded total adjusted by ${summary.roundingAdjustment.toLocaleString(undefined, { style: 'currency', currency: input.currency })}.`);
  }

  if (input.taxPercent > 0) {
    baseTips.push(`Tax contributed ${summary.totalTax.toLocaleString(undefined, { style: 'currency', currency: input.currency })} to the total.`);
  }

  return baseTips;
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
