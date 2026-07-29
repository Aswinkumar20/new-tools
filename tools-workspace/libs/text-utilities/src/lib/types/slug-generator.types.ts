export type SlugSeparator = '-' | '_' | '+';

export interface SlugSeparatorOption {
  value: SlugSeparator;
  label: string;
}

export interface SlugGenerationOptions {
  text: string;
  separator: string;
  removeNumbers: boolean;
}

export interface SlugSuggestionContext {
  hasInput: boolean;
  hasSlug: boolean;
  slugLength: number;
  separator: string;
  removeNumbers: boolean;
  inputLooksLikeUrl: boolean;
  inputLooksLikeSlug: boolean;
}
