import type { FormControl, FormGroup } from '@angular/forms';

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

export type HashOutputFormat = 'hex' | 'base64' | 'both';

export interface HashResult {
  algorithm: HashAlgorithm;
  hex: string;
  base64: string;
  lengthBits: number;
}

export type HashGeneratorFormGroup = FormGroup<{
  input: FormControl<string>;
  algorithm: FormControl<HashAlgorithm>;
  uppercase: FormControl<boolean>;
  outputFormat: FormControl<HashOutputFormat>;
}>;

export interface HashGeneratorFormValues {
  input: string;
  algorithm: HashAlgorithm;
  uppercase: boolean;
  outputFormat: HashOutputFormat;
}

export interface HashAlgorithmOption {
  value: HashAlgorithm;
  label: string;
  available: boolean;
}

export interface HashSuggestionContext {
  hasInput: boolean;
  hasResult: boolean;
  hasError: boolean;
  algorithm: HashAlgorithm;
  errorMessage: string | null;
}
