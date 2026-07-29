import type { FormControl, FormGroup } from '@angular/forms';

export type JwtPart = 'header' | 'payload' | 'signature';

export interface JwtDecodedSection {
  raw: string;
  json: string | null;
  error: string | null;
}

export interface DecodedJwt {
  header: JwtDecodedSection;
  payload: JwtDecodedSection;
  signature: {
    raw: string;
    present: boolean;
  };
}

export type JwtDecoderFormGroup = FormGroup<{
  token: FormControl<string>;
  prettyPrint: FormControl<boolean>;
  showDecoded: FormControl<boolean>;
}>;

export interface JwtDecoderFormValues {
  token: string;
  prettyPrint: boolean;
  showDecoded: boolean;
}

export interface JwtDecodeOutcome {
  decoded: DecodedJwt | null;
  errors: string[];
  warnings: string[];
}

export interface JwtSuggestionContext {
  hasToken: boolean;
  hasDecoded: boolean;
  partCount: number;
  errorMessage: string | null;
  warningMessage: string | null;
  headerError: string | null;
  payloadError: string | null;
  signaturePresent: boolean;
}
