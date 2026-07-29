export type UnicodeEscapeConversionMode = 'encode' | 'decode';

export interface UnicodeEscapeConversionOptions {
  mode: UnicodeEscapeConversionMode;
  inputText: string;
}

export interface UnicodeEscapeConversionResult {
  output: string;
}

export interface UnicodeEscapeSuggestionContext {
  mode: UnicodeEscapeConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  inputLooksLikeEscaped: boolean;
  inputHasNonAscii: boolean;
  outputUnchanged: boolean;
}
