import type { FormControl, FormGroup } from '@angular/forms';

export type EmailUrlIpCheckMode = 'auto' | 'email' | 'url' | 'ip';

export type EmailUrlIpValueType = 'email' | 'url' | 'ip' | 'unknown';

export type EmailUrlIpInfoValue = string | number | boolean | null;

export interface EmailUrlIpAnalysisResult {
  value: string;
  trimmed: string;
  type: EmailUrlIpValueType;
  modeUsed: EmailUrlIpCheckMode;
  valid: boolean;
  issues: string[];
  info: Record<string, EmailUrlIpInfoValue>;
}

export type EmailUrlIpFormGroup = FormGroup<{
  input: FormControl<string>;
  mode: FormControl<EmailUrlIpCheckMode>;
  allowMultiple: FormControl<boolean>;
  ignoreEmpty: FormControl<boolean>;
}>;

export interface EmailUrlIpFormValues {
  input: string;
  mode: EmailUrlIpCheckMode;
  allowMultiple: boolean;
  ignoreEmpty: boolean;
}

export interface EmailUrlIpAnalyzeOutcome {
  results: EmailUrlIpAnalysisResult[];
  errors: string[];
}

export interface EmailUrlIpSuggestionContext {
  hasInput: boolean;
  hasResults: boolean;
  validCount: number;
  invalidCount: number;
  typeCounts: Record<EmailUrlIpValueType, number>;
  results: EmailUrlIpAnalysisResult[];
  errorMessage: string | null;
}
