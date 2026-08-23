import { FormControl, FormGroup } from '@angular/forms';

export type BarcodeFormat =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'EAN8'
  | 'UPC'
  | 'ITF14'
  | 'MSI'
  | 'pharmacode'
  | 'codabar';

export type BarcodeTextAlign = 'left' | 'center' | 'right';
export type BarcodeTextPosition = 'bottom' | 'top';

export interface BarcodeOptions {
  text: string;
  format: BarcodeFormat;
  width: number;
  height: number;
  displayValue: boolean;
  fontSize: number;
  textAlign: BarcodeTextAlign;
  textPosition: BarcodeTextPosition;
  textMargin: number;
  background: string;
  lineColor: string;
  margin: number;
}

export type BarcodeFormGroup = FormGroup<{
  text: FormControl<string>;
  format: FormControl<BarcodeFormat>;
  width: FormControl<number>;
  height: FormControl<number>;
  displayValue: FormControl<boolean>;
  fontSize: FormControl<number>;
  textAlign: FormControl<BarcodeTextAlign>;
  textPosition: FormControl<BarcodeTextPosition>;
  textMargin: FormControl<number>;
  background: FormControl<string>;
  lineColor: FormControl<string>;
  margin: FormControl<number>;
}>;

export interface BarcodeFormatOption {
  value: BarcodeFormat;
  label: string;
  description: string;
}

