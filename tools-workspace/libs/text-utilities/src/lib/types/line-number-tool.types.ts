export type LineNumberMode = 'add' | 'remove';

export interface LineNumberConversionOptions {
  mode: LineNumberMode;
  inputText: string;
  startNumber: number;
  separator: string;
}

export interface LineNumberConversionResult {
  output: string;
}

export interface LineNumberSuggestionContext {
  mode: LineNumberMode;
  hasInput: boolean;
  hasOutput: boolean;
  lineCount: number;
  inputLooksNumbered: boolean;
}
