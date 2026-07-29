import type { ReadabilityResult } from '../shared/text-transform.utils';

export type { ReadabilityResult };

export interface ReadabilityAnalysisResult {
  readability: ReadabilityResult | null;
  output: string;
}

export interface ReadabilitySuggestionContext {
  hasInput: boolean;
  wordCount: number;
  fleschReadingEase: number;
  readingLevel: string;
}
