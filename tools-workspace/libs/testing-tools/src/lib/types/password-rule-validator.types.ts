import type { FormControl, FormGroup } from '@angular/forms';

export type PasswordRuleStrengthLevel =
  | 'very-weak'
  | 'weak'
  | 'medium'
  | 'strong'
  | 'very-strong';

export interface PasswordRuleConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  optional?: boolean;
}

export interface PasswordRuleStatus extends PasswordRuleConfig {
  passed: boolean;
}

export type PasswordRuleFormGroup = FormGroup<{
  password: FormControl<string>;
  minLength: FormControl<number>;
  requireUppercase: FormControl<boolean>;
  requireLowercase: FormControl<boolean>;
  requireNumber: FormControl<boolean>;
  requireSymbol: FormControl<boolean>;
  noSpaces: FormControl<boolean>;
  noCommon: FormControl<boolean>;
}>;

export interface PasswordRuleFormValues {
  password: string;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  noSpaces: boolean;
  noCommon: boolean;
}

export interface PasswordRuleEvaluation {
  rules: PasswordRuleStatus[];
  passedCount: number;
  totalCount: number;
  strengthLevel: PasswordRuleStrengthLevel;
  strengthLabel: string;
  strengthPercent: number;
  allPassed: boolean;
}

export interface PasswordRuleSuggestionContext {
  hasInput: boolean;
  allPassed: boolean;
  failedRuleIds: string[];
  strengthLevel: PasswordRuleStrengthLevel;
}
