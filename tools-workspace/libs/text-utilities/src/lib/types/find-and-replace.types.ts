export interface FindAndReplaceOptionsState {
  useRegex: boolean;
  caseSensitive: boolean;
  replaceAll: boolean;
}

export interface FindAndReplaceResult {
  output: string;
  errorMessage: string;
  matchCount: number;
}

export interface FindAndReplaceSuggestionContext {
  hasInput: boolean;
  hasFindText: boolean;
  hasOutput: boolean;
  errorMessage: string;
  matchCount: number;
  useRegex: boolean;
  outputUnchanged: boolean;
}
