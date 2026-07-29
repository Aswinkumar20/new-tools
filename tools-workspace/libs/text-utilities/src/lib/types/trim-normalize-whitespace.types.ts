export interface TrimNormalizeOptions {
  trimLines: boolean;
  collapseSpaces: boolean;
  removeEmptyLines: boolean;
  normalizeLineEndings: boolean;
}

export interface TrimNormalizeConversionOptions extends TrimNormalizeOptions {
  inputText: string;
}

export interface TrimNormalizeConversionResult {
  output: string;
}

export interface TrimNormalizeSuggestionContext extends TrimNormalizeOptions {
  hasInput: boolean;
  hasOutput: boolean;
  outputUnchanged: boolean;
  hasLineEdgeWhitespace: boolean;
  hasCollapsedWhitespaceRuns: boolean;
  hasEmptyLines: boolean;
  hasNonLfLineEndings: boolean;
  activeOptionCount: number;
}
