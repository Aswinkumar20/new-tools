export type SearchConfidence = 'high' | 'medium' | 'low';

export type SearchMatchType =
  | 'exact'
  | 'keyword'
  | 'semantic'
  | 'fuzzy'
  | 'intent'
  | 'synonym';

export interface ToolSearchDocument {
  id: string;
  path: string;
  name: string;
  description: string;
  category: string;
  categoryPath: string;
  actions: string[];
  objects: string[];
  inputFormats: string[];
  outputFormats: string[];
  keywords: string[];
  synonyms: string[];
  useCases: string[];
  tags: string[];
  /** Prebuilt lowercase bag used for keyword / semantic overlap. */
  searchText: string;
  tokens: string[];
  popularity: number;
  qualityScore: number;
}

export interface DetectedIntent {
  action: string | null;
  object: string | null;
  inputFormat: string | null;
  outputFormat: string | null;
  goal: string | null;
  isAmbiguousAction: boolean;
  isMultiIntent: boolean;
  actions: string[];
  objects: string[];
}

export interface SearchRankingWeights {
  semantic: number;
  keyword: number;
  intent: number;
  action: number;
  object: number;
  format: number;
  fuzzy: number;
  quality: number;
}

export interface ToolSearchResult {
  toolId: string;
  path: string;
  name: string;
  description: string;
  category: string;
  categoryPath: string;
  score: number;
  matchType: SearchMatchType;
  matchExplanation?: string;
  tags: string[];
}

export interface SearchClarification {
  question: string;
  options: Array<{ label: string; query: string }>;
}

export interface ToolSearchResponse {
  query: string;
  normalizedQuery: string;
  intent: DetectedIntent;
  confidence: SearchConfidence;
  results: ToolSearchResult[];
  related: ToolSearchResult[];
  clarification: SearchClarification | null;
  recoveryHint: string | null;
  zeroResult: boolean;
}

export interface AutocompleteSuggestion {
  label: string;
  query: string;
  toolId?: string;
  path?: string;
  category?: string;
  kind: 'tool' | 'phrase' | 'category';
}

export interface ToolMetadataOverride {
  actions?: string[];
  objects?: string[];
  inputFormats?: string[];
  outputFormats?: string[];
  keywords?: string[];
  synonyms?: string[];
  useCases?: string[];
  tags?: string[];
  qualityScore?: number;
}
