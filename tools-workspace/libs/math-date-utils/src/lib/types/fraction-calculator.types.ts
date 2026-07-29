import type { FormControl, FormGroup } from '@angular/forms';

export type FractionOperation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface MixedFraction {
  sign: 1 | -1;
  whole: number;
  numerator: number;
  denominator: number;
}

export type FractionFormGroup = FormGroup<{
  numerator: FormControl<string | null>;
  denominator: FormControl<string | null>;
}>;

export interface FractionOperationMeta {
  id: FractionOperation;
  label: string;
  symbol: string;
  helper: string;
}

export interface FractionComputation {
  operation: FractionOperation;
  left: Fraction;
  right: Fraction;
  raw: Fraction;
  simplified: Fraction;
  decimalValue: number;
  decimalFormatted: string;
  mixed: MixedFraction | null;
  steps: string[];
  explanation: string;
}

export interface FractionPreset {
  id: string;
  label: string;
  operation: FractionOperation;
  left: { numerator: string; denominator: string };
  right: { numerator: string; denominator: string };
  description: string;
}

export interface FractionOperationOptions {
  autoSimplify: boolean;
  showSteps: boolean;
  precision: number;
}

export type FractionCalculatorFormGroup = FormGroup<{
  fractionA: FractionFormGroup;
  fractionB: FractionFormGroup;
  operation: FormControl<FractionOperation>;
  autoSimplify: FormControl<boolean>;
  showSteps: FormControl<boolean>;
  precision: FormControl<number>;
}>;

export interface FractionCalculatorFormValues {
  fractionA: { numerator: string; denominator: string };
  fractionB: { numerator: string; denominator: string };
  operation: FractionOperation;
  autoSimplify: boolean;
  showSteps: boolean;
  precision: number;
}

export interface FractionSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  operation: FractionOperation;
  autoSimplify: boolean;
  isWholeNumber: boolean;
  isImproper: boolean;
  canSimplifyFurther: boolean;
}
