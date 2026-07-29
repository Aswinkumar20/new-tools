export type MorseConversionMode = 'encode' | 'decode';

export interface MorseConversionOptions {
  mode: MorseConversionMode;
  inputText: string;
}

export interface MorseConversionResult {
  output: string;
}

export interface MorseSuggestionContext {
  mode: MorseConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  inputLooksLikeMorse: boolean;
}
