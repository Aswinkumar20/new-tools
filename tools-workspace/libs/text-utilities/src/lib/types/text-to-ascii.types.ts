export type TextToAsciiFormat = 'text' | 'ascii' | 'binary' | 'hex';

export interface TextToAsciiFormatOption {
  value: TextToAsciiFormat;
  label: string;
  description: string;
}

export interface TextToAsciiConversionOptions {
  input: string;
  leftType: TextToAsciiFormat;
  rightType: TextToAsciiFormat;
}

export interface TextToAsciiConversionResult {
  output: string;
}

export interface TextToAsciiSuggestionContext {
  hasInput: boolean;
  hasOutput: boolean;
  hasError: boolean;
  leftType: TextToAsciiFormat;
  rightType: TextToAsciiFormat;
  inputLooksLikeAscii: boolean;
  inputLooksLikeBinary: boolean;
  inputLooksLikeHex: boolean;
}
