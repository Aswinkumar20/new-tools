import type { FormControl, FormGroup } from '@angular/forms';

export type SplitMode = 'equal' | 'custom';

export interface TipPreset {
  label: string;
  amount: string;
  tipPercent: string;
  taxPercent?: string;
  splitCount?: string;
}

export interface TipInput {
  amount: number;
  tipPercent: number;
  taxPercent: number;
  splitMode: SplitMode;
  splitCount: number;
  round: boolean;
  customShares: number[];
  currency: string;
}

export interface TipSummary {
  totalBill: number;
  totalTip: number;
  totalTax: number;
  grandTotal: number;
  perPerson: number[];
  perPersonLabels: string[];
  roundingAdjustment: number;
}

export interface TipResult {
  summary: TipSummary;
  tips: string[];
}

export interface TipHistoryEntry extends TipResult {
  amount: number;
  tipPercent: number;
  taxPercent: number;
  splitCount: number;
  timestamp: number;
}

export type TipCalculatorFormGroup = FormGroup<{
  amount: FormControl<string | null>;
  tipPercent: FormControl<string | null>;
  taxPercent: FormControl<string | null>;
  splitMode: FormControl<SplitMode>;
  splitCount: FormControl<string | null>;
  customShares: FormControl<string[] | null>;
  round: FormControl<boolean>;
  currency: FormControl<string | null>;
  includeHistory: FormControl<boolean>;
}>;

export interface TipCalculatorFormValues {
  amount: string;
  tipPercent: string;
  taxPercent: string;
  splitMode: SplitMode;
  splitCount: string;
  customShares: string[];
  round: boolean;
  currency: string;
  includeHistory: boolean;
}

export interface TipSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  tipPercent: number;
  taxPercent: number;
  splitCount: number;
  splitMode: SplitMode;
  amount: number;
  currency: string;
}
