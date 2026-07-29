import type { FormControl, FormGroup } from '@angular/forms';

export type CalculatorMode =
  | 'percentageOf'
  | 'isWhatPercent'
  | 'percentageChange'
  | 'percentageIncrease'
  | 'percentageDecrease';

export type PercentageFieldId =
  | 'baseValue'
  | 'percentageValue'
  | 'resultValue'
  | 'increaseDecreaseValue';

export type AdvancedOptionId = 'roundResult' | 'includeDifference' | 'showSteps';

export interface ModeDefinition {
  id: CalculatorMode;
  label: string;
  description: string;
  icon: string;
  requiredFields: PercentageFieldId[];
}

export interface PresetDefinition {
  label: string;
  mode: CalculatorMode;
  baseValue: string;
  percentageValue: string;
  resultValue?: string;
  increaseDecreaseValue?: string;
}

export interface AdvancedOption {
  id: AdvancedOptionId;
  label: string;
  description: string;
}

export interface PercentageCalculatorOptions {
  mode: CalculatorMode;
  baseValue: number;
  percentageValue: number;
  resultValue: number;
  increaseDecreaseValue: number;
  includeDifference: boolean;
  showSteps: boolean;
}

export interface CalculationResult extends PercentageCalculatorOptions {
  value: number;
  difference?: number;
  steps?: string[];
  timestamp: number;
}

export interface CalculationHistory extends CalculationResult {
  decimalPlaces: number;
  roundResult: boolean;
}

export type PercentageCalculatorFormGroup = FormGroup<{
  mode: FormControl<CalculatorMode>;
  baseValue: FormControl<string | null>;
  percentageValue: FormControl<string | null>;
  resultValue: FormControl<string | null>;
  increaseDecreaseValue: FormControl<string | null>;
  decimalPlaces: FormControl<number>;
  showSteps: FormControl<boolean>;
  roundResult: FormControl<boolean>;
  includeDifference: FormControl<boolean>;
}>;

export interface PercentageCalculatorFormValues {
  mode: CalculatorMode;
  baseValue: string;
  percentageValue: string;
  resultValue: string;
  increaseDecreaseValue: string;
  decimalPlaces: number;
  showSteps: boolean;
  roundResult: boolean;
  includeDifference: boolean;
}

export interface PercentageSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  mode: CalculatorMode;
  percentageValue: number;
  baseValue: number;
  resultValue: number;
}
