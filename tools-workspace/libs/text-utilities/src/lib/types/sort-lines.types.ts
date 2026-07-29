import type { SortMode } from '../shared/text-transform.utils';

export type { SortMode };

export interface SortModeOption {
  value: SortMode;
  label: string;
}

export interface SortLinesConversionOptions {
  inputText: string;
  sortMode: SortMode;
  caseSensitive: boolean;
}

export interface SortLinesConversionResult {
  output: string;
}

export interface SortLinesSuggestionContext {
  hasInput: boolean;
  hasOutput: boolean;
  lineCount: number;
  sortMode: SortMode;
  caseSensitive: boolean;
  outputUnchanged: boolean;
  looksMostlyNumeric: boolean;
  hasDuplicateLines: boolean;
}
