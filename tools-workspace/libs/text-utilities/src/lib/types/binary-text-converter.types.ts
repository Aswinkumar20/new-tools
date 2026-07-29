export type BinaryConversionMode = 'encode' | 'decode';

export type BinarySeparatorOption = 'none' | 'space' | 'colon';

export type BinaryBitWidth = 8 | 16;

export interface BinarySeparatorChoice {
  value: BinarySeparatorOption;
  label: string;
}

export interface BinaryConversionOptions {
  mode: BinaryConversionMode;
  inputText: string;
  separator: BinarySeparatorOption;
  bits: BinaryBitWidth;
}

export interface BinaryConversionResult {
  output: string;
  errorMessage: string;
}

export interface BinarySuggestionContext {
  mode: BinaryConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  errorMessage: string;
  bits: BinaryBitWidth;
  inputLooksLikeBinary: boolean;
}
