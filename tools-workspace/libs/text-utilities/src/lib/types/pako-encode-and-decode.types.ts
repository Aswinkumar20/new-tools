import type {
  PakoBinaryEncoding,
  PakoFormat
} from '../shared/pako-compression.utils';

export type { PakoBinaryEncoding, PakoFormat };

export type PakoConversionMode = 'encode' | 'decode';

export interface PakoConversionOptions {
  mode: PakoConversionMode;
  inputText: string;
  compressionFormat: PakoFormat;
  binaryEncoding: PakoBinaryEncoding;
  compressionLevel: number;
}

export interface PakoConversionResult {
  output: string;
  errorMessage: string;
  inputBytes: number;
  outputBytes: number;
  compressionRatio: number;
}

export interface PakoSuggestionContext {
  mode: PakoConversionMode;
  hasInput: boolean;
  hasOutput: boolean;
  errorMessage: string;
  binaryEncoding: PakoBinaryEncoding;
  compressionRatio: number;
  inputLooksEncoded: boolean;
}
