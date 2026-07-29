import type { FormControl, FormGroup } from '@angular/forms';

export type PasswordStrengthLevel =
  | 'very-weak'
  | 'weak'
  | 'medium'
  | 'strong'
  | 'very-strong';

export interface PasswordStrengthBreakdown {
  lengthScore: number;
  varietyScore: number;
  bonusScore: number;
}

export type PasswordStrengthFormGroup = FormGroup<{
  password: FormControl<string>;
  showDetails: FormControl<boolean>;
}>;

export interface PasswordStrengthFormValues {
  password: string;
  showDetails: boolean;
}

export interface PasswordStrengthAnalysis {
  breakdown: PasswordStrengthBreakdown;
  score: number;
  level: PasswordStrengthLevel;
  label: string;
  percent: number;
  tips: string[];
}

export interface PasswordStrengthSuggestionContext {
  hasPassword: boolean;
  level: PasswordStrengthLevel;
  score: number;
}
