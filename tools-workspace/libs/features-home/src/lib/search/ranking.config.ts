import { SearchRankingWeights } from './types';

/** Tunable hybrid ranking weights — must sum roughly to 1.0 for interpretability. */
export const DEFAULT_RANKING_WEIGHTS: SearchRankingWeights = {
  semantic: 0.28,
  keyword: 0.22,
  intent: 0.18,
  action: 0.1,
  object: 0.1,
  format: 0.06,
  fuzzy: 0.04,
  quality: 0.02,
};

export const SEARCH_LIMITS = {
  maxQueryLength: 200,
  maxResults: 24,
  dropdownResults: 10,
  relatedResults: 4,
  autocompleteResults: 8,
  highConfidenceMinScore: 0.55,
  mediumConfidenceMinScore: 0.32,
  relatedMinScore: 0.22,
  candidatePoolSize: 80,
} as const;
