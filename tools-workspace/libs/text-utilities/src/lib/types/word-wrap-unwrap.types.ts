export type WordWrapMode = 'wrap' | 'unwrap';

export interface WordWrapConversionOptions {
  mode: WordWrapMode;
  inputText: string;
  wrapWidth: number;
}

export interface WordWrapConversionResult {
  output: string;
}

export interface WordWrapSuggestionContext {
  mode: WordWrapMode;
  hasInput: boolean;
  hasOutput: boolean;
  wrapWidth: number;
  outputUnchanged: boolean;
  hasLongLines: boolean;
  hasSoftLineBreaks: boolean;
}
