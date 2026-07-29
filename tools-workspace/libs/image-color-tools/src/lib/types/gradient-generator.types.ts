import type { FormArray, FormControl, FormGroup } from '@angular/forms';

export type GradientType = 'linear' | 'radial' | 'conic';

export interface GradientColorStop {
  color: string;
  position: number;
}

export interface GradientResult {
  css: string;
  type: GradientType;
  colors: GradientColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
}

export interface GradientHistoryEntry {
  timestamp: number;
  css: string;
  preview: string;
}

export interface GradientPreset {
  label: string;
  description: string;
  type: GradientType;
  colors: GradientColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
}

export type ColorStopFormGroup = FormGroup<{
  color: FormControl<string>;
  position: FormControl<number>;
}>;

export type GradientFormGroup = FormGroup<{
  type: FormControl<GradientType>;
  angle: FormControl<number>;
  position: FormControl<string>;
  shape: FormControl<string>;
  size: FormControl<string>;
  colorStops: FormArray<ColorStopFormGroup>;
  rememberHistory: FormControl<boolean>;
}>;

export interface GradientFormValues {
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  colorStops: GradientColorStop[];
  rememberHistory: boolean;
}

export interface GradientDefaults {
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  stops: ReadonlyArray<GradientColorStop>;
}
