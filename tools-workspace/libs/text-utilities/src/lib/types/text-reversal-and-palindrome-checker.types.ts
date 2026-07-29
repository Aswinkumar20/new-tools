export type TextReversalMode = 'palindrome' | 'reverse';

export interface TextReversalSample {
  text: string;
  badge: string;
  badgeKind: 'yes' | 'no' | 'neutral';
}

export interface TextReversalAnalysisResult {
  resultText: string;
  palindromeStatus: boolean | null;
  normalizedLength: number;
}

export interface TextReversalSuggestionContext {
  mode: TextReversalMode;
  hasInput: boolean;
  hasResult: boolean;
  palindromeStatus: boolean | null;
  normalizedLength: number;
  inputEqualsReversed: boolean;
}
