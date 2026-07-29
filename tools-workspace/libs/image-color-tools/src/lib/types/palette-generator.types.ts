import type { FormControl, FormGroup } from '@angular/forms';
import type { SafeUrl } from '@angular/platform-browser';
import type { HslColor, RgbColor } from '../utils/ict-color.utils';

export type PaletteExtractionMethod =
  | 'dominant'
  | 'vibrant'
  | 'muted'
  | 'light'
  | 'dark';

export interface PaletteMethodOption {
  value: PaletteExtractionMethod;
  label: string;
}

export interface PaletteColorInfo {
  hex: string;
  rgb: RgbColor;
  hsl: HslColor;
  percentage: number;
}

export interface PaletteResult {
  colors: PaletteColorInfo[];
  previewUrl: SafeUrl;
  filename: string | null;
  method: string;
  colorCount: number;
}

export interface PaletteHistoryEntry {
  timestamp: number;
  filename: string | null;
  colors: PaletteColorInfo[];
  preview: string;
}

export type PaletteFormGroup = FormGroup<{
  colorCount: FormControl<number>;
  method: FormControl<string>;
  rememberHistory: FormControl<boolean>;
}>;

export interface QuantizedColorCount {
  r: number;
  g: number;
  b: number;
  count: number;
}
