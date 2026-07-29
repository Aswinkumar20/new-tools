import type { FormControl, FormGroup } from '@angular/forms';

export type LoanType = 'reducing' | 'flat';
export type PaymentFrequencyId = 'monthly' | 'biweekly' | 'weekly';
export type ExtraPaymentMode = 'none' | 'monthly' | 'annually';

export interface PaymentFrequency {
  id: PaymentFrequencyId;
  label: string;
  periodsPerYear: number;
}

export interface LoanPreset {
  label: string;
  amount: string;
  rate: string;
  termYears: string;
  termMonths?: string;
  frequency?: PaymentFrequencyId;
  loanType?: LoanType;
  startDate?: string;
}

export interface LoanInput {
  amount: number;
  rate: number;
  termMonths: number;
  frequency: PaymentFrequency;
  loanType: LoanType;
  startDate?: Date;
  extraPayment: number;
  extraMode: ExtraPaymentMode;
}

export interface LoanSummary {
  emi: number;
  totalPayments: number;
  totalInterest: number;
  payoffDate?: Date;
  durationMonths: number;
  savingsFromExtra?: number;
  originalInterestWithoutExtra?: number;
}

export interface ScheduleEntry {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  extraPayment: number;
  balance: number;
  paymentDate?: Date;
}

export interface LoanResult {
  summary: LoanSummary;
  schedulePreview: ScheduleEntry[];
  insights: string[];
}

export interface LoanHistoryEntry extends LoanResult {
  amount: number;
  rate: number;
  termMonths: number;
  frequency: PaymentFrequencyId;
  loanType: LoanType;
  createdAt: number;
}

export type LoanEmiFormGroup = FormGroup<{
  amount: FormControl<string | null>;
  rate: FormControl<string | null>;
  termYears: FormControl<string | null>;
  termMonths: FormControl<string | null>;
  frequency: FormControl<PaymentFrequencyId>;
  loanType: FormControl<LoanType>;
  startDate: FormControl<string | null>;
  extraPayment: FormControl<string | null>;
  extraMode: FormControl<ExtraPaymentMode>;
  includeHistory: FormControl<boolean>;
}>;

export interface LoanEmiFormValues {
  amount: string;
  rate: string;
  termYears: string;
  termMonths: string;
  frequency: PaymentFrequencyId;
  loanType: LoanType;
  startDate: string;
  extraPayment: string;
  extraMode: ExtraPaymentMode;
  includeHistory: boolean;
}

export interface LoanEmiSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  loanType: LoanType;
  ratePercent: number;
  termMonths: number;
  amount: number;
  frequency: PaymentFrequencyId;
  hasExtraPayments: boolean;
  hasInterestSavings: boolean;
}
