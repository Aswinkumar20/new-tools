import type { KeywordEntry } from '../shared/text-transform.utils';

export type { KeywordEntry };

export interface KeywordDensityOptions {
  inputText: string;
  topN: number;
  excludeStopWords: boolean;
}

export interface KeywordDensityResult {
  keywords: KeywordEntry[];
  output: string;
}

export interface KeywordDensitySuggestionContext {
  hasInput: boolean;
  keywordCount: number;
  excludeStopWords: boolean;
  topDensity: number;
  topWord: string;
}
