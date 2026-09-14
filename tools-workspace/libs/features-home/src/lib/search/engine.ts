import { ToolCategoryCatalog } from '../config/tools-catalog.generated';
import { buildSearchIndex } from './index-builder';
import { detectIntent, intentExplanation } from './intent';
import { clampQuery, normalizeText, tokenize } from './normalize';
import { DEFAULT_RANKING_WEIGHTS, SEARCH_LIMITS } from './ranking.config';
import { scoreDocument } from './scoring';
import {
  AutocompleteSuggestion,
  SearchClarification,
  SearchConfidence,
  SearchRankingWeights,
  ToolSearchDocument,
  ToolSearchResponse,
  ToolSearchResult,
} from './types';

export interface ToolSearchEngineOptions {
  weights?: Partial<SearchRankingWeights>;
  maxResults?: number;
}

const AMBIGUOUS_ACTION_OPTIONS: Record<string, Array<{ label: string; query: string }>> = {
  compress: [
    { label: 'Image', query: 'compress image' },
    { label: 'PDF', query: 'compress pdf' },
    { label: 'Audio / media', query: 'compress audio' },
  ],
  convert: [
    { label: 'Image / Base64', query: 'convert image' },
    { label: 'JSON / data', query: 'convert json' },
    { label: 'PDF', query: 'convert pdf' },
    { label: 'Text case', query: 'convert text case' },
  ],
  merge: [
    { label: 'PDF', query: 'merge pdf' },
    { label: 'Text', query: 'merge text' },
  ],
  split: [
    { label: 'PDF', query: 'split pdf' },
    { label: 'Text', query: 'split text' },
  ],
  edit: [
    { label: 'PDF', query: 'edit pdf' },
    { label: 'Text', query: 'edit text' },
  ],
  resize: [
    { label: 'Image', query: 'resize image' },
    { label: 'PDF page', query: 'crop pdf page' },
  ],
};

export class ToolSearchEngine {
  private readonly documents: ToolSearchDocument[];
  private readonly weights: SearchRankingWeights;
  private readonly queryCache = new Map<string, ToolSearchResponse>();

  constructor(catalog: ToolCategoryCatalog[], options: ToolSearchEngineOptions = {}) {
    this.documents = buildSearchIndex(catalog);
    this.weights = { ...DEFAULT_RANKING_WEIGHTS, ...options.weights };
  }

  get size(): number {
    return this.documents.length;
  }

  search(rawQuery: string, options: { limit?: number } = {}): ToolSearchResponse {
    const query = clampQuery(rawQuery, SEARCH_LIMITS.maxQueryLength);
    const cacheKey = `${query.toLowerCase()}::${options.limit ?? SEARCH_LIMITS.maxResults}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const normalizedQuery = normalizeText(query);
    const intent = detectIntent(query);
    const queryTokens = tokenize(normalizedQuery);
    const limit = options.limit ?? SEARCH_LIMITS.maxResults;

    if (!normalizedQuery || queryTokens.length === 0) {
      const empty: ToolSearchResponse = {
        query,
        normalizedQuery,
        intent,
        confidence: 'low',
        results: [],
        related: [],
        clarification: null,
        recoveryHint: null,
        zeroResult: true,
      };
      return empty;
    }

    const scored = this.documents
      .map((doc) => {
        const breakdown = scoreDocument(doc, normalizedQuery, queryTokens, intent, this.weights);
        return { doc, breakdown };
      })
      .filter((entry) => entry.breakdown.total > 0.08)
      .sort((left, right) => {
        const scoreDiff = right.breakdown.total - left.breakdown.total;
        if (Math.abs(scoreDiff) > 0.0001) {
          return scoreDiff;
        }
        return right.doc.popularity - left.doc.popularity;
      });

    const top = scored.slice(0, limit);
    const results = top.map((entry) => this.toResult(entry.doc, entry.breakdown.total, entry.breakdown.matchType, intent));

    const primary = results[0];
    const related = this.buildRelated(scored, primary, intent);
    const clarification = this.buildClarification(intent, results);
    const confidence = this.resolveConfidence(results, intent, clarification);
    const zeroResult = results.length === 0;
    const recoveryHint = zeroResult
      ? this.buildRecoveryHint(intent)
      : confidence === 'low' && results.length
        ? "We couldn't find an exact match. You might be looking for:"
        : null;

    // Soft recovery: if zero results, retry with looser fuzzy-only pool
    let finalResults = results;
    let finalRelated = related;
    let finalZero = zeroResult;
    let finalHint = recoveryHint;
    if (zeroResult) {
      const loose = this.documents
        .map((doc) => {
          const breakdown = scoreDocument(doc, normalizedQuery, queryTokens, intent, {
            ...this.weights,
            fuzzy: 0.35,
            semantic: 0.25,
            keyword: 0.2,
          });
          return { doc, breakdown };
        })
        .filter((entry) => entry.breakdown.total > 0.12)
        .sort((a, b) => b.breakdown.total - a.breakdown.total)
        .slice(0, Math.min(6, limit));
      if (loose.length) {
        finalResults = loose.map((entry) =>
          this.toResult(entry.doc, entry.breakdown.total, entry.breakdown.matchType, intent)
        );
        finalRelated = [];
        finalZero = false;
        finalHint = "We couldn't find an exact match. You might be looking for:";
      }
    }

    const response: ToolSearchResponse = {
      query,
      normalizedQuery,
      intent,
      confidence: finalZero ? 'low' : confidence,
      results: finalResults,
      related: finalRelated,
      clarification,
      recoveryHint: finalHint,
      zeroResult: finalZero,
    };

    if (this.queryCache.size > 200) {
      this.queryCache.clear();
    }
    this.queryCache.set(cacheKey, response);
    return response;
  }

  autocomplete(rawQuery: string, limit = SEARCH_LIMITS.autocompleteResults): AutocompleteSuggestion[] {
    const query = clampQuery(rawQuery, SEARCH_LIMITS.maxQueryLength);
    if (!query.trim()) {
      return [];
    }
    const response = this.search(query, { limit });
    const suggestions: AutocompleteSuggestion[] = response.results.map((result) => ({
      label: result.name,
      query: result.name,
      toolId: result.toolId,
      path: result.path,
      category: result.category,
      kind: 'tool' as const,
    }));

    if (response.clarification) {
      for (const option of response.clarification.options) {
        suggestions.push({
          label: `${response.intent.action ?? 'Search'} → ${option.label}`,
          query: option.query,
          kind: 'phrase',
        });
      }
    }

    // Phrase suggestions from synonyms when query is short
    const normalized = normalizeText(query);
    if (normalized.length >= 4) {
      for (const doc of this.documents) {
        for (const synonym of doc.synonyms) {
          if (synonym.startsWith(normalized) || synonym.includes(normalized)) {
            suggestions.push({
              label: `${titleCase(synonym)} → ${doc.name}`,
              query: synonym,
              toolId: doc.id,
              path: doc.path,
              category: doc.category,
              kind: 'phrase',
            });
          }
        }
      }
    }

    const seen = new Set<string>();
    return suggestions
      .filter((item) => {
        const key = `${item.kind}:${item.label}:${item.path ?? ''}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }

  private toResult(
    doc: ToolSearchDocument,
    score: number,
    matchType: ToolSearchResult['matchType'],
    intent: ReturnType<typeof detectIntent>
  ): ToolSearchResult {
    return {
      toolId: doc.id,
      path: doc.path,
      name: doc.name,
      description: doc.description,
      category: doc.category,
      categoryPath: doc.categoryPath,
      score,
      matchType,
      matchExplanation: intentExplanation(intent),
      tags: doc.tags.slice(0, 6),
    };
  }

  private buildRelated(
    scored: Array<{ doc: ToolSearchDocument; breakdown: { total: number } }>,
    primary: ToolSearchResult | undefined,
    intent: ReturnType<typeof detectIntent>
  ): ToolSearchResult[] {
    if (!primary) {
      return [];
    }
    const related: ToolSearchResult[] = [];
    for (const entry of scored) {
      if (entry.doc.path === primary.path) {
        continue;
      }
      if (entry.breakdown.total < SEARCH_LIMITS.relatedMinScore) {
        continue;
      }
      const sameCategory = entry.doc.categoryPath === primary.categoryPath;
      const sharesObject =
        intent.objects.length > 0 && intent.objects.some((object) => entry.doc.objects.includes(object));
      const complementaryAction =
        intent.actions.length > 0 &&
        entry.doc.actions.some((action) => action !== intent.action) &&
        sharesObject;
      if (!sameCategory && !sharesObject && !complementaryAction) {
        continue;
      }
      // Avoid unrelated compressors across media types
      if (intent.objects.length && !sharesObject) {
        continue;
      }
      related.push(this.toResult(entry.doc, entry.breakdown.total, 'semantic', intent));
      if (related.length >= SEARCH_LIMITS.relatedResults) {
        break;
      }
    }
    return related;
  }

  private buildClarification(
    intent: ReturnType<typeof detectIntent>,
    results: ToolSearchResult[]
  ): SearchClarification | null {
    if (!intent.isAmbiguousAction || !intent.action) {
      return null;
    }
    const options = AMBIGUOUS_ACTION_OPTIONS[intent.action];
    if (!options?.length) {
      return null;
    }
    // Only clarify when top results span multiple categories
    const categories = new Set(results.slice(0, 6).map((result) => result.categoryPath));
    if (categories.size <= 1 && results.length > 0 && results[0].score > 0.7) {
      return null;
    }
    return {
      question: `What would you like to ${intent.action}?`,
      options,
    };
  }

  private resolveConfidence(
    results: ToolSearchResult[],
    intent: ReturnType<typeof detectIntent>,
    clarification: SearchClarification | null
  ): SearchConfidence {
    if (!results.length || clarification) {
      return 'low';
    }
    const top = results[0].score;
    const second = results[1]?.score ?? 0;
    const margin = top - second;
    if (top >= SEARCH_LIMITS.highConfidenceMinScore && (margin >= 0.08 || intent.object || intent.action)) {
      return 'high';
    }
    if (top >= SEARCH_LIMITS.mediumConfidenceMinScore) {
      return 'medium';
    }
    return 'low';
  }

  private buildRecoveryHint(intent: ReturnType<typeof detectIntent>): string {
    if (intent.goal === 'reduce_file_size') {
      return 'Are you trying to reduce the file size?';
    }
    if (intent.action === 'merge') {
      return 'Are you trying to combine files?';
    }
    if (intent.action === 'convert') {
      return 'Are you trying to change a file format?';
    }
    return "We couldn't find an exact match. You might be looking for:";
  }
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

let singleton: ToolSearchEngine | null = null;

/** Shared engine for home + nav — built once from the generated catalog. */
export function getToolSearchEngine(catalog: ToolCategoryCatalog[]): ToolSearchEngine {
  if (!singleton || singleton.size !== catalog.reduce((n, c) => n + (c.subCategories?.length ?? 0), 0)) {
    singleton = new ToolSearchEngine(catalog);
  }
  return singleton;
}

/** Test helper to reset cached singleton between specs. */
export function resetToolSearchEngine(): void {
  singleton = null;
}
