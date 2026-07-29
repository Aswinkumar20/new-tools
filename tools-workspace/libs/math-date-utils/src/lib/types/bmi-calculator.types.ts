import type { FormControl, FormGroup } from '@angular/forms';

export type UnitSystem = 'metric' | 'imperial';
export type Gender = 'male' | 'female' | 'unspecified';
export type RiskLevel = 'low' | 'moderate' | 'high';

export interface UnitOption {
  id: UnitSystem;
  label: string;
  weightLabel: string;
  heightLabel: string;
}

export interface BmiPreset {
  label: string;
  unit: UnitSystem;
  weight: string;
  height: string;
  age?: string;
  gender?: Gender;
  waist?: string;
}

export interface BmiInput {
  unit: UnitSystem;
  weight: number;
  height: number;
  age?: number;
  gender: Gender;
  waist?: number;
}

export interface BmiCategory {
  id: string;
  label: string;
  min: number;
  max: number;
  recommendation: string;
}

export interface BmiSummary {
  bmi: number;
  classification: BmiCategory;
  interpretation: string;
  idealRange: string;
  weightDifference: number;
}

export interface BmiBreakdown {
  weightKg: number;
  heightM: number;
  bmi: number;
  lowerWeightLimit: number;
  upperWeightLimit: number;
}

export interface RiskIndicator {
  label: string;
  level: RiskLevel;
  description: string;
}

export interface BmiResult {
  summary: BmiSummary;
  breakdown?: BmiBreakdown;
  recommendations: string[];
  riskIndicators: RiskIndicator[];
}

export type BmiHistory = BmiResult & BmiInput;

export type BmiCalculatorFormGroup = FormGroup<{
  unit: FormControl<UnitSystem>;
  weight: FormControl<string | null>;
  height: FormControl<string | null>;
  age: FormControl<string | null>;
  gender: FormControl<Gender>;
  waist: FormControl<string | null>;
  includeHistory: FormControl<boolean>;
}>;

export interface BmiCalculatorFormValues {
  unit: UnitSystem;
  weight: string;
  height: string;
  age: string;
  gender: Gender;
  waist: string;
  includeHistory: boolean;
}

export interface BmiSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  categoryId: string | null;
  age?: number;
  hasWaist: boolean;
  hasHighWaistRisk: boolean;
  unit: UnitSystem;
}
