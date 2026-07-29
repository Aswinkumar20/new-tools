export type Base64ConversionMode = 'encode' | 'decode';

export interface Base64ConversionResult {
  output: string;
  errorMessage: string;
}

export interface Base64SuggestionContext {
  mode: Base64ConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  errorMessage: string;
  inputLooksLikeBase64: boolean;
}
