import type { FormControl, FormGroup } from '@angular/forms';

export type LocaleCode = 'en-US' | 'en-UK' | 'en-IN';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR';
export type NumberFormat = 'cardinal' | 'ordinal' | 'currency';
export type CaseStyle = 'sentence' | 'title' | 'upper' | 'lower';

export interface FormatOption {
  id: NumberFormat;
  label: string;
  description: string;
  icon: string;
}

export interface CaseStyleOption {
  id: CaseStyle;
  label: string;
  description: string;
}

export interface ScaleDefinition {
  thousands: string[];
  primaryGroupSize: number;
  secondaryGroupSize?: number;
}

export interface LocaleDefinition {
  id: LocaleCode;
  label: string;
  sample: string;
  groupSeparator: string;
  decimalSeparator: string;
  scale: ScaleDefinition;
  ordinalSupport: boolean;
}

export interface CurrencyDefinition {
  code: CurrencyCode;
  label: string;
  majorSingular: string;
  majorPlural: string;
  minorSingular: string;
  minorPlural: string;
  symbol: string;
  supportedLocales: LocaleCode[];
}

export interface ConversionResult {
  text: string;
  input: string;
  locale: LocaleCode;
  format: NumberFormat;
  timestamp: number;
  caseStyle: CaseStyle;
  includeAnd: boolean;
  includeCents: boolean;
  handleNegative: boolean;
  showCurrencySymbol: boolean;
  currency: CurrencyCode;
}

export type ConversionHistory = ConversionResult;

export interface SampleNumber {
  label: string;
  value: string;
  format?: NumberFormat;
  locale?: LocaleCode;
  currency?: CurrencyCode;
}

export interface ConverterOptions {
  locale: LocaleDefinition;
  currency: CurrencyDefinition;
  includeAnd: boolean;
  includeCents: boolean;
  handleNegative: boolean;
  showCurrencySymbol: boolean;
  caseStyle: CaseStyle;
  format: NumberFormat;
}

export interface NumberChunk {
  value: number;
  scaleIndex: number;
}

export type NumberToWordsFormGroup = FormGroup<{
  numericInput: FormControl<string | null>;
  locale: FormControl<LocaleCode>;
  format: FormControl<NumberFormat>;
  currency: FormControl<CurrencyCode>;
  showCurrencySymbol: FormControl<boolean>;
  includeCents: FormControl<boolean>;
  caseStyle: FormControl<CaseStyle>;
  includeAnd: FormControl<boolean>;
  handleNegative: FormControl<boolean>;
}>;

export interface NumberToWordsFormValues {
  numericInput: string;
  locale: LocaleCode;
  format: NumberFormat;
  currency: CurrencyCode;
  showCurrencySymbol: boolean;
  includeCents: boolean;
  caseStyle: CaseStyle;
  includeAnd: boolean;
  handleNegative: boolean;
}

export interface NumberToWordsSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  format: NumberFormat;
  locale: LocaleCode;
  numericInput: string;
  isNegative: boolean;
  hasDecimal: boolean;
  absoluteValue: number;
}
