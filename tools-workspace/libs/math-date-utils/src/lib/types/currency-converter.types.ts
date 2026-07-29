import type { FormControl, FormGroup } from '@angular/forms';

export interface RateSnapshot {
  base: string;
  timestamp: number;
  rates: Record<string, number>;
  provider: string;
}

export interface ExchangeApiResponse {
  result: string;
  base_code: string;
  time_last_update_unix: number;
  rates: Record<string, number>;
}

export interface FallbackApiResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

export interface CurrencyDescriptor {
  code: string;
  name: string;
  symbol?: string;
}

export interface ConversionResult {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  inverseRate: number;
  convertedAmount: number;
  feeAmount: number;
  amountAfterFee: number;
  timestamp: number;
  provider: string;
}

export interface WatchlistEntry {
  code: string;
  name: string;
  rate?: number;
  changePercent?: number;
  lastUpdated?: number;
}

export interface MoverEntry {
  code: string;
  name: string;
  rate: number;
  changePercent: number;
}

export type CurrencyConverterFormGroup = FormGroup<{
  amount: FormControl<string | null>;
  fromCurrency: FormControl<string | null>;
  toCurrency: FormControl<string | null>;
  includeFees: FormControl<boolean | null>;
  feePercent: FormControl<string | null>;
  currencySearch: FormControl<string | null>;
}>;

export interface CurrencyConverterFormValues {
  amount: string;
  fromCurrency: string;
  toCurrency: string;
  includeFees: boolean;
  feePercent: string;
  currencySearch: string;
}

export interface CurrencySuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  fromCurrency: string;
  toCurrency: string;
  includeFees: boolean;
  amount: number;
  convertedAmount: number;
}
