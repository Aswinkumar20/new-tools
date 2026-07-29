export type Rot13CipherMode = 'rot13' | 'caesar';

export interface Rot13ConversionOptions {
  mode: Rot13CipherMode;
  inputText: string;
  caesarShift: number;
}

export interface Rot13ConversionResult {
  output: string;
}

export interface Rot13SuggestionContext {
  mode: Rot13CipherMode;
  hasInput: boolean;
  hasOutput: boolean;
  caesarShift: number;
  decodeShift: number;
  inputHasLetters: boolean;
}
