import type { FormControl, FormGroup } from '@angular/forms';

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export type TimezoneFormGroup = FormGroup<{
  dateTime: FormControl<string>;
  sourceTimezone: FormControl<string>;
  targetTimezone: FormControl<string>;
}>;

export interface TimezoneFormValues {
  dateTime: string;
  sourceTimezone: string;
  targetTimezone: string;
}

export interface TimezoneConversionSide {
  time: string;
  timezone: string;
  offset: string;
}

export interface TimezoneConversionResult {
  source: TimezoneConversionSide;
  target: TimezoneConversionSide;
  difference: string;
}
