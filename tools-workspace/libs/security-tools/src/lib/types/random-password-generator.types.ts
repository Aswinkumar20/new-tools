import type { FormControl, FormGroup } from '@angular/forms';

export type RandomPasswordStrengthLevel =
  | 'very-weak'
  | 'weak'
  | 'medium'
  | 'strong'
  | 'very-strong';

export interface GeneratedPassword {
  value: string;
  createdAt: number;
}

export type RandomPasswordFormGroup = FormGroup<{
  length: FormControl<number>;
  includeLowercase: FormControl<boolean>;
  includeUppercase: FormControl<boolean>;
  includeNumbers: FormControl<boolean>;
  includeSymbols: FormControl<boolean>;
  avoidAmbiguous: FormControl<boolean>;
}>;

export interface RandomPasswordFormValues {
  length: number;
  includeLowercase: boolean;
  includeUppercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  avoidAmbiguous: boolean;
}

export interface RandomPasswordGenerateResult {
  password: GeneratedPassword | null;
  errors: string[];
}

export interface RandomPasswordSuggestionContext {
  hasPassword: boolean;
  hasError: boolean;
  errorMessage: string | null;
  length: number;
  strengthLevel: RandomPasswordStrengthLevel;
}
