export interface TextSimilarityResult {
  similarity: number;
  distance: number;
  report: string;
}

export interface TextSimilaritySuggestionContext {
  hasTextA: boolean;
  hasTextB: boolean;
  similarity: number;
  distance: number;
  lengthA: number;
  lengthB: number;
}
