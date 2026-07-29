import type { FormControl, FormGroup } from '@angular/forms';

export type TextCryptoMode = 'encrypt' | 'decrypt';

export interface TextCryptoState {
  output: string;
  lastAction: TextCryptoMode | null;
}

export type TextEncryptDecryptFormGroup = FormGroup<{
  mode: FormControl<TextCryptoMode>;
  plaintext: FormControl<string>;
  ciphertext: FormControl<string>;
  password: FormControl<string>;
}>;

export interface TextEncryptDecryptFormValues {
  mode: TextCryptoMode;
  plaintext: string;
  ciphertext: string;
  password: string;
}

export interface TextEncryptDecryptSuggestionContext {
  mode: TextCryptoMode;
  hasPassword: boolean;
  hasPlaintext: boolean;
  hasCiphertext: boolean;
  hasOutput: boolean;
  lastAction: TextCryptoMode | null;
  errorMessage: string | null;
}
