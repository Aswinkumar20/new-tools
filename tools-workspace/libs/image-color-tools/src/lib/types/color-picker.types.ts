import type { FormControl, FormGroup } from '@angular/forms';
import type { HslColor, HslaColor, RgbColor } from '../utils/ict-color.utils';

export interface ColorPickerResult {
  hex: string;
  rgb: RgbColor;
  rgba: RgbColor & { a: number };
  hsl: HslColor;
  hsla: HslaColor;
  valid: boolean;
}

export interface ColorPickerHistoryEntry {
  timestamp: number;
  hex: string;
  rgb: string;
}

export interface ColorPreset {
  label: string;
  hex: string;
}

export type ColorPickerFormGroup = FormGroup<{
  hex: FormControl<string>;
  red: FormControl<number | null>;
  green: FormControl<number | null>;
  blue: FormControl<number | null>;
  hue: FormControl<number | null>;
  saturation: FormControl<number | null>;
  lightness: FormControl<number | null>;
  alpha: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

export interface ColorPickerDefaults {
  hex: string;
  red: number;
  green: number;
  blue: number;
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
}
