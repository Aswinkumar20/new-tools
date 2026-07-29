import type { FormControl, FormGroup } from '@angular/forms';

export interface UuidEntry {
  value: string;
  createdAt: number;
}

export type UuidGeneratorFormGroup = FormGroup<{
  uppercase: FormControl<boolean>;
  withBraces: FormControl<boolean>;
  withHyphens: FormControl<boolean>;
  count: FormControl<number>;
}>;

export interface UuidGeneratorFormValues {
  uppercase: boolean;
  withBraces: boolean;
  withHyphens: boolean;
  count: number;
}

export interface UuidGenerateResult {
  entries: UuidEntry[];
  errors: string[];
}

export interface UuidSuggestionContext {
  hasUuids: boolean;
  uuidCount: number;
  batchCount: number;
  withHyphens: boolean;
  errorMessage: string | null;
}
