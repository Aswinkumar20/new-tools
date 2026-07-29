export type JsonStringConversionMode = 'encode' | 'decode';

export interface JsonStringConversionOptions {
  mode: JsonStringConversionMode;
  inputText: string;
}

export interface JsonStringConversionResult {
  output: string;
  errorMessage: string;
}

export interface JsonStringSuggestionContext {
  mode: JsonStringConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  errorMessage: string;
  inputLooksLikeEscaped: boolean;
}
