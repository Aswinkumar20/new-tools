import type { FormControl, FormGroup } from '@angular/forms';

export interface PrivateNotesState {
  encrypted: string | null;
  lastSavedAt: number | null;
}

export type PrivateNotesFormGroup = FormGroup<{
  note: FormControl<string>;
  password: FormControl<string>;
  showNote: FormControl<boolean>;
}>;

export interface PrivateNotesFormValues {
  note: string;
  password: string;
  showNote: boolean;
}

export interface PrivateNotesSuggestionContext {
  hasNote: boolean;
  hasPassword: boolean;
  passwordLength: number;
  hasEncrypted: boolean;
  isLocked: boolean;
  errorMessage: string | null;
}
