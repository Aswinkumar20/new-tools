import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { debounceTime } from 'rxjs';
import {
  TIP_CURRENCIES,
  TIP_DEFAULT_CUSTOM_SHARES,
  TIP_DEFAULT_FORM,
  TIP_HISTORY_LIMIT,
  TIP_PRESETS,
  TIP_RELATED_TOOLS
} from '../../constants/tip-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  SplitMode,
  TipCalculatorFormGroup,
  TipCalculatorFormValues,
  TipHistoryEntry,
  TipInput,
  TipPreset,
  TipResult
} from '../../types/tip-calculator.types';
import {
  calculateTip,
  formatTipCurrency,
  formatTipPercent,
  formatTipSummaryText,
  mapTipCalculationError,
  numberValidator,
  resolveTipSuggestion,
  toNumber
} from '../../utils/tip-calculator.utils';

@Component({
  selector: 'lib-tip-calculator',
  standalone: true,
  templateUrl: './tip-calculator.html',
  styleUrls: ['./tip-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TipCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly presets = TIP_PRESETS;
  readonly currencies = TIP_CURRENCIES;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = TIP_RELATED_TOOLS;

  readonly form: TipCalculatorFormGroup = this.fb.group({
    amount: this.fb.control(TIP_DEFAULT_FORM.amount, [
      Validators.required,
      numberValidator,
      Validators.min(0)
    ]),
    tipPercent: this.fb.control(TIP_DEFAULT_FORM.tipPercent, [
      Validators.required,
      numberValidator,
      Validators.min(0)
    ]),
    taxPercent: this.fb.control(TIP_DEFAULT_FORM.taxPercent, [
      numberValidator,
      Validators.min(0)
    ]),
    splitMode: this.fb.control<SplitMode>(TIP_DEFAULT_FORM.splitMode, { nonNullable: true }),
    splitCount: this.fb.control(TIP_DEFAULT_FORM.splitCount, [
      numberValidator,
      Validators.min(1)
    ]),
    customShares: this.fb.control<string[]>([...TIP_DEFAULT_FORM.customShares]),
    round: this.fb.control(TIP_DEFAULT_FORM.round, { nonNullable: true }),
    currency: this.fb.control(TIP_DEFAULT_FORM.currency, [Validators.required]),
    includeHistory: this.fb.control(TIP_DEFAULT_FORM.includeHistory, { nonNullable: true })
  });

  readonly result = signal<TipResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<TipHistoryEntry[]>([]);
  readonly formSnapshot = signal<TipCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly tips = computed(() => this.result()?.tips ?? []);
  readonly splitMode = computed(() => this.formSnapshot().splitMode);

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveTipSuggestion({
      hasResult: this.result() !== null,
      hasError: this.errorMessage() !== null,
      tipPercent: toNumber(snapshot.tipPercent),
      taxPercent: toNumber(snapshot.taxPercent),
      splitCount: Math.max(1, Math.floor(toNumber(snapshot.splitCount))),
      splitMode: snapshot.splitMode,
      amount: toNumber(snapshot.amount),
      currency: snapshot.currency
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(80), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.calculate();
    });

    this.calculate();
  }

  setSplitMode(mode: SplitMode): void {
    if (mode === this.form.controls.splitMode.value) {
      return;
    }
    this.form.patchValue({ splitMode: mode }, { emitEvent: true });
    this.toast.info(`${mode === 'equal' ? 'Equal split' : 'Custom shares'} enabled.`);
  }

  applyPreset(preset: TipPreset): void {
    this.form.patchValue(
      {
        amount: preset.amount,
        tipPercent: preset.tipPercent,
        taxPercent: preset.taxPercent ?? this.form.controls.taxPercent.value ?? '0',
        splitCount: preset.splitCount ?? this.form.controls.splitCount.value ?? '1',
        splitMode: 'equal'
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.toast.info('Tip recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  async copyResult(): Promise<void> {
    const current = this.summary();
    if (!current) {
      return;
    }
    await mdCopyText(
      this.toast,
      formatTipSummaryText(current, this.formSnapshot().currency),
      'Result'
    );
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
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatCurrency(value: number): string {
    return formatTipCurrency(value, this.formSnapshot().currency);
  }

  formatPercent(value: number): string {
    return formatTipPercent(value);
  }

  onCustomShareInput(event: Event, index: number): void {
    const target = event.target as HTMLInputElement;
    const value = toNumber(target.value);
    const shares = [...(this.form.controls.customShares.value ?? [])];
    shares[index] = value > 0 ? value.toString() : '1';
    this.form.patchValue({ customShares: shares }, { emitEvent: true });
  }

  readonly trackPreset = (_: number, preset: TipPreset): string => preset.label;
  readonly trackTip = (_: number, tip: string): string => tip;
  readonly trackHistory = (_: number, entry: TipHistoryEntry): string =>
    `${entry.amount}-${entry.tipPercent}-${entry.taxPercent}-${entry.splitCount}`;

  private calculate(): void {
    this.errorMessage.set(null);

    try {
      const input = this.buildInput();
      const tipResult = calculateTip(input);
      this.result.set(tipResult);

      if (this.form.controls.includeHistory.value) {
        this.pushHistory(tipResult, input);
      }
    } catch (error) {
      this.errorMessage.set(mapTipCalculationError(error));
      this.result.set(null);
    }
  }

  private buildInput(): TipInput {
    const amount = toNumber(this.form.controls.amount.value);
    const tipPercent = toNumber(this.form.controls.tipPercent.value);
    const taxPercent = toNumber(this.form.controls.taxPercent.value);
    const splitMode = this.form.controls.splitMode.value;
    const splitCount = Math.max(1, Math.floor(toNumber(this.form.controls.splitCount.value)));
    const round = this.form.controls.round.value;
    const currency = (this.form.controls.currency.value ?? 'USD').toString();

    const customSharesRaw = this.form.controls.customShares.value ?? [];
    const customShares = customSharesRaw.map((value) => toNumber(value)).filter((share) => share > 0);

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
        (item) =>
          !(
            item.amount === entry.amount &&
            item.tipPercent === entry.tipPercent &&
            item.taxPercent === entry.taxPercent &&
            item.splitCount === entry.splitCount
          )
      );
      return [entry, ...filtered].slice(0, TIP_HISTORY_LIMIT);
    });
  }

  private readFormValues(): TipCalculatorFormValues {
    return {
      amount: this.form.controls.amount.value ?? '',
      tipPercent: this.form.controls.tipPercent.value ?? '',
      taxPercent: this.form.controls.taxPercent.value ?? '',
      splitMode: this.form.controls.splitMode.value,
      splitCount: this.form.controls.splitCount.value ?? '',
      customShares: [...(this.form.controls.customShares.value ?? TIP_DEFAULT_CUSTOM_SHARES.map(String))],
      round: this.form.controls.round.value,
      currency: this.form.controls.currency.value ?? 'USD',
      includeHistory: this.form.controls.includeHistory.value
    };
  }
}
