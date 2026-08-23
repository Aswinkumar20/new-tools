import { FormControl, FormGroup } from '@angular/forms';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCodeOptions {
  text: string;
  size: number;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  darkColor: string;
  lightColor: string;
  margin: number;
}

export type QrCodeFormGroup = FormGroup<{
  text: FormControl<string>;
  size: FormControl<number>;
  errorCorrectionLevel: FormControl<QrErrorCorrectionLevel>;
  darkColor: FormControl<string>;
  lightColor: FormControl<string>;
  margin: FormControl<number>;
}>;

