import type { FormControl, FormGroup } from '@angular/forms';

export interface SecureClipboardState {
  stored: string | null;
  expiresAt: number | null;
}

export type SecureClipboardFormGroup = FormGroup<{
  text: FormControl<string>;
  password: FormControl<string>;
  ttlSeconds: FormControl<number>;
}>;

export interface SecureClipboardFormValues {
  text: string;
  password: string;
  ttlSeconds: number;
}

export interface SecureClipboardSuggestionContext {
  hasText: boolean;
  hasPassword: boolean;
  hasStored: boolean;
  isActive: boolean;
  ttlSeconds: number;
  errorMessage: string | null;
  warningMessage: string | null;
}
