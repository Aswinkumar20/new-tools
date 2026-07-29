export type SplitJoinMode = 'split' | 'join';

export interface SplitJoinConversionOptions {
  mode: SplitJoinMode;
  inputText: string;
  delimiter: string;
}

export interface SplitJoinConversionResult {
  output: string;
}

export interface SplitJoinSuggestionContext {
  mode: SplitJoinMode;
  hasInput: boolean;
  hasOutput: boolean;
  delimiter: string;
  outputUnchanged: boolean;
  looksLikeLineList: boolean;
  looksLikeDelimitedList: boolean;
  partCount: number;
}
