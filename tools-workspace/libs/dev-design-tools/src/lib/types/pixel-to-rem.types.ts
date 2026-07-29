export type PixelRemDirection = 'px-to-rem' | 'rem-to-px';

export interface PixelRemConversionResult {
  input: number;
  output: number;
  formula: string;
}

export interface PixelRemHistoryEntry {
  timestamp: number;
  input: number;
  output: number;
  direction: PixelRemDirection;
  baseSize: number;
}

export interface PixelRemCommonSize {
  px: number;
  rem: number;
}

export interface PixelRemFormValues {
  direction: PixelRemDirection;
  inputValue: number;
  baseSize: number;
}
