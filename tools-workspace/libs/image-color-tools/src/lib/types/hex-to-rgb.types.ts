import type { FormControl, FormGroup } from '@angular/forms';
import type { HslColor, HslaColor, RgbColor } from '../utils/ict-color.utils';

export type HexRgbInputMode = 'hex' | 'rgb';

export interface HexRgbColorResult {
  hex: string;
  rgb: RgbColor;
  rgba: RgbColor & { a: number };
  hsl: HslColor;
  hsla: HslaColor;
  valid: boolean;
}

export interface HexRgbHistoryEntry {
  timestamp: number;
  hex: string;
  rgb: string;
}

export type HexRgbFormGroup = FormGroup<{
  hex: FormControl<string>;
  red: FormControl<number | null>;
  green: FormControl<number | null>;
  blue: FormControl<number | null>;
  alpha: FormControl<number>;
  rememberHistory: FormControl<boolean>;
}>;

export interface HexRgbDefaults {
  hex: string;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}
