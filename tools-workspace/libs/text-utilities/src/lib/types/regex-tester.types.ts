export interface RegexFlagState {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
  dotAll: boolean;
  unicode: boolean;
}

export interface RegexTestOptions {
  inputText: string;
  pattern: string;
  flags: RegexFlagState;
}

export interface RegexTesterResult {
  matchCount: number;
  output: string;
  errorMessage: string;
}

export interface RegexSuggestionContext {
  hasInput: boolean;
  hasPattern: boolean;
  hasOutput: boolean;
  errorMessage: string;
  matchCount: number;
  flagGlobal: boolean;
}
