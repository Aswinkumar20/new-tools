import { CommonModule, DatePipe } from '@angular/common';
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
  LOAN_EMI_DEFAULT_FORM,
  LOAN_EMI_HISTORY_LIMIT,
  LOAN_EMI_MIN_AMOUNT,
  LOAN_EMI_PAYMENT_FREQUENCIES,
  LOAN_EMI_PRESETS,
  LOAN_EMI_RELATED_TOOLS
} from '../../constants/loan-emi-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  ExtraPaymentMode,
  LoanEmiFormGroup,
  LoanEmiFormValues,
  LoanHistoryEntry,
  LoanInput,
  LoanPreset,
  LoanResult,
  LoanType,
  PaymentFrequency,
  PaymentFrequencyId,
  ScheduleEntry
} from '../../types/loan-emi-calculator.types';
import {
  calculateLoanEmi,
  formatLoanCurrency,
  formatLoanPercent,
  formatLoanSummaryText,
  loanTypeLabel,
  mapLoanCalculationError,
  numberValidator,
  resolveLoanEmiSuggestion,
  resolvePaymentFrequency,
  toNumber
} from '../../utils/loan-emi-calculator.utils';

@Component({
  selector: 'lib-loan-emi-calculator',
  standalone: true,
  templateUrl: './loan-emi-calculator.html',
  styleUrls: ['./loan-emi-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, DatePipe, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoanEmiCalculatorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly presets = LOAN_EMI_PRESETS;
  readonly frequencies = LOAN_EMI_PAYMENT_FREQUENCIES;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = LOAN_EMI_RELATED_TOOLS;

  readonly form: LoanEmiFormGroup = this.fb.group({
    amount: this.fb.control(LOAN_EMI_DEFAULT_FORM.amount, [
      Validators.required,
      numberValidator,
      Validators.min(LOAN_EMI_MIN_AMOUNT)
    ]),
    rate: this.fb.control(LOAN_EMI_DEFAULT_FORM.rate, [
      Validators.required,
      numberValidator,
      Validators.min(0.1)
    ]),
    termYears: this.fb.control(LOAN_EMI_DEFAULT_FORM.termYears, [
      Validators.required,
      numberValidator,
      Validators.min(1)
    ]),
    termMonths: this.fb.control(LOAN_EMI_DEFAULT_FORM.termMonths, [
      numberValidator,
      Validators.min(0)
    ]),
    frequency: this.fb.control<PaymentFrequencyId>(LOAN_EMI_DEFAULT_FORM.frequency, {
      nonNullable: true
    }),
    loanType: this.fb.control<LoanType>(LOAN_EMI_DEFAULT_FORM.loanType, { nonNullable: true }),
    startDate: this.fb.control(LOAN_EMI_DEFAULT_FORM.startDate),
    extraPayment: this.fb.control(LOAN_EMI_DEFAULT_FORM.extraPayment, [
      numberValidator,
      Validators.min(0)
    ]),
    extraMode: this.fb.control<ExtraPaymentMode>(LOAN_EMI_DEFAULT_FORM.extraMode, {
      nonNullable: true
    }),
    includeHistory: this.fb.control(LOAN_EMI_DEFAULT_FORM.includeHistory, { nonNullable: true })
  });

  readonly result = signal<LoanResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<LoanHistoryEntry[]>([]);
  readonly formSnapshot = signal<LoanEmiFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly schedulePreview = computed(() => this.result()?.schedulePreview ?? []);
  readonly insights = computed(() => this.result()?.insights ?? []);

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const suggestion = resolveLoanEmiSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      loanType: snapshot.loanType,
      ratePercent: toNumber(snapshot.rate),
      termMonths: toNumber(snapshot.termYears) * 12 + toNumber(snapshot.termMonths),
      amount: toNumber(snapshot.amount),
      frequency: snapshot.frequency,
      hasExtraPayments: snapshot.extraMode !== 'none' && toNumber(snapshot.extraPayment) > 0,
      hasInterestSavings: Boolean(current?.summary.savingsFromExtra)
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(100), takeUntilDestroyed()).subscribe(() => {
      this.formSnapshot.set(this.readFormValues());
      this.calculate();
    });

    this.calculate();
  }

  setLoanType(type: LoanType): void {
    if (type === this.form.controls.loanType.value) {
      return;
    }
    this.form.patchValue({ loanType: type }, { emitEvent: true });
    this.toast.info(`${loanTypeLabel(type)} loan selected.`);
  }

  applyPreset(preset: LoanPreset): void {
    this.form.patchValue(
      {
        amount: preset.amount,
        rate: preset.rate,
        termYears: preset.termYears,
        termMonths: preset.termMonths ?? '0',
        frequency: preset.frequency ?? this.form.controls.frequency.value,
        loanType: preset.loanType ?? this.form.controls.loanType.value,
        startDate: preset.startDate ?? this.form.controls.startDate.value ?? '',
        extraPayment: '0',
        extraMode: 'none'
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.toast.info('Loan recalculated.');
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
    await mdCopyText(this.toast, formatLoanSummaryText(current), 'Result');
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
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatCurrency(value: number): string {
    return formatLoanCurrency(value);
  }

  formatPercent(value: number): string {
    return formatLoanPercent(value);
  }

  readonly trackPreset = (_: number, preset: LoanPreset): string => preset.label;
  readonly trackFrequency = (_: number, frequency: PaymentFrequency): PaymentFrequencyId =>
    frequency.id;
  readonly trackSchedule = (_: number, item: ScheduleEntry): number => item.period;
  readonly trackInsight = (_: number, insight: string): string => insight;
  readonly trackHistory = (_: number, entry: LoanHistoryEntry): string =>
    `${entry.amount}-${entry.rate}-${entry.termMonths}-${entry.frequency}-${entry.loanType}`;

  private calculate(): void {
    this.errorMessage.set(null);

    try {
      const input = this.buildInput();
      const loanResult = calculateLoanEmi(input);
      this.result.set(loanResult);

      if (this.form.controls.includeHistory.value) {
        this.pushHistory(loanResult, input);
      }
    } catch (error) {
      this.errorMessage.set(mapLoanCalculationError(error));
      this.result.set(null);
    }
  }

  private buildInput(): LoanInput {
    const amount = toNumber(this.form.controls.amount.value);
    const rate = toNumber(this.form.controls.rate.value) / 100;
    const termYears = toNumber(this.form.controls.termYears.value);
    const termMonthsExtra = toNumber(this.form.controls.termMonths.value);
    const totalMonths = termYears * 12 + termMonthsExtra;

    if (totalMonths <= 0) {
      throw new Error('Loan tenure must be greater than zero months.');
    }

    const startDateRaw = this.form.controls.startDate.value ?? '';
    const startDate = startDateRaw ? new Date(startDateRaw) : undefined;

    return {
      amount,
      rate,
      termMonths: totalMonths,
      frequency: resolvePaymentFrequency(this.form.controls.frequency.value),
      loanType: this.form.controls.loanType.value,
      startDate,
      extraPayment: toNumber(this.form.controls.extraPayment.value),
      extraMode: this.form.controls.extraMode.value
    };
  }

  private pushHistory(loanResult: LoanResult, input: LoanInput): void {
    const entry: LoanHistoryEntry = {
      ...loanResult,
      amount: input.amount,
      rate: input.rate * 100,
      termMonths: input.termMonths,
      frequency: input.frequency.id,
      loanType: input.loanType,
      createdAt: Date.now()
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) =>
          !(
            item.amount === entry.amount &&
            item.rate === entry.rate &&
            item.termMonths === entry.termMonths &&
            item.frequency === entry.frequency &&
            item.loanType === entry.loanType
          )
      );
      return [entry, ...filtered].slice(0, LOAN_EMI_HISTORY_LIMIT);
    });
  }

  private readFormValues(): LoanEmiFormValues {
    return {
      amount: this.form.controls.amount.value ?? '',
      rate: this.form.controls.rate.value ?? '',
      termYears: this.form.controls.termYears.value ?? '',
      termMonths: this.form.controls.termMonths.value ?? '',
      frequency: this.form.controls.frequency.value,
      loanType: this.form.controls.loanType.value,
      startDate: this.form.controls.startDate.value ?? '',
      extraPayment: this.form.controls.extraPayment.value ?? '',
      extraMode: this.form.controls.extraMode.value,
      includeHistory: this.form.controls.includeHistory.value
    };
  }
}
