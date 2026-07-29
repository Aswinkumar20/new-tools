import { FormControl, FormGroup } from '@angular/forms';

export interface GeneratedNumber {
  value: number;
  timestamp: number;
}

export interface RandomNumberStats {
  count: number;
  min: number;
  max: number;
  average: number;
  sum: number;
}

export interface RandomNumberOptions {
  min: number;
  max: number;
  count: number;
  integerOnly: boolean;
  decimals: number;
}

export type RandomFormGroup = FormGroup<{
  min: FormControl<number>;
  max: FormControl<number>;
  count: FormControl<number>;
  integerOnly: FormControl<boolean>;
  decimals: FormControl<number>;
}>;
