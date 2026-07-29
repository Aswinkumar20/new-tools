export type HexConversionMode = 'encode' | 'decode';

export type HexSeparatorOption = 'none' | 'space' | 'colon';

export interface HexSeparatorChoice {
  value: HexSeparatorOption;
  label: string;
}

export interface HexConversionOptions {
  mode: HexConversionMode;
  inputText: string;
  separator: HexSeparatorOption;
}

export interface HexConversionResult {
  output: string;
  errorMessage: string;
}

export interface HexSuggestionContext {
  mode: HexConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  errorMessage: string;
  inputLooksLikeHex: boolean;
}
