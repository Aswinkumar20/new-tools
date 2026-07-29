import type { FormControl, FormGroup } from '@angular/forms';
import type { Observable } from 'rxjs';

export type UnitType =
  | 'length'
  | 'area'
  | 'volume'
  | 'weight'
  | 'temperature'
  | 'time'
  | 'speed'
  | 'acceleration'
  | 'energy'
  | 'power'
  | 'force'
  | 'pressure'
  | 'density'
  | 'torque'
  | 'flowRate'
  | 'frequency'
  | 'angle'
  | 'illuminance'
  | 'luminance'
  | 'radiation'
  | 'magneticField'
  | 'capacitance'
  | 'resistance'
  | 'inductance'
  | 'electricCharge'
  | 'electricCurrent'
  | 'electricPotential'
  | 'conductance'
  | 'impedance'
  | 'surfaceTension'
  | 'data'
  | 'currency';

export interface UnitDefinition {
  id: string;
  label: string;
  symbol?: string;
  aliases?: string[];
  type: UnitType;
  dimension?: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
  notes?: string;
  precision?: number;
}

export interface CategoryDefinition {
  id: UnitType;
  title: string;
  description: string;
  primary: string;
  featuredUnits: string[];
  icon: string;
  source?: 'internal' | 'external';
  meta?: Record<string, string>;
}

export interface ConversionResult {
  inputValue: number;
  inputUnit: UnitDefinition;
  outputValue: number;
  outputUnit: UnitDefinition;
  timestamp: number;
  formula?: string;
  precision: number;
}

export interface ConversionPreset {
  id: string;
  name: string;
  category: UnitType;
  inputUnit: string;
  outputUnit: string;
  createdAt: number;
}

export interface QuickConversionShortcut {
  id: string;
  label: string;
  detail: string;
  category: UnitType;
  inputUnit: string;
  outputUnit: string;
}

export type PromptFn = (message?: string, defaultValue?: string) => string | null;

export interface ExternalRateProvider {
  id: string;
  label: string;
  fetchRates: () => Observable<Record<string, number>>;
  ttl: number;
}

export type UnitConverterFormGroup = FormGroup<{
  inputValue: FormControl<number>;
  inputUnit: FormControl<string>;
  outputUnit: FormControl<string>;
}>;

export interface UnitConverterFormValues {
  inputValue: number;
  inputUnit: string;
  outputUnit: string;
}

export interface UnitSuggestionContext {
  hasResult: boolean;
  hasError: boolean;
  category: UnitType;
  inputUnitId: string;
  outputUnitId: string;
  inputValue: number;
}
