import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { keywordDensity, type KeywordEntry } from '../shared/text-transform.utils';
import {
  KEYWORD_DENSITY_DEFAULT_TOP_N,
  KEYWORD_DENSITY_HIGH_THRESHOLD,
  KEYWORD_DENSITY_MAX_TOP_N,
  KEYWORD_DENSITY_MIN_TOP_N
} from '../constants/keyword-density.constants';
import type {
  KeywordDensityOptions,
  KeywordDensityResult,
  KeywordDensitySuggestionContext
} from '../types/keyword-density.types';

export function clampKeywordTopN(value: number): number {
  return Math.max(
    KEYWORD_DENSITY_MIN_TOP_N,
    Math.min(KEYWORD_DENSITY_MAX_TOP_N, Math.round(value || KEYWORD_DENSITY_DEFAULT_TOP_N))
  );
}

export function formatKeywordDensityTable(keywords: KeywordEntry[]): string {
  if (!keywords.length) {
    return '';
  }
  const header = 'Rank  Keyword              Count   Density %';
  const divider = '----  -------------------- -----   -----------';
  const rows = keywords.map(
    (entry, i) =>
      `${String(i + 1).padStart(4)}  ${entry.word.padEnd(20).slice(0, 20)} ${String(entry.count).padStart(5)}   ${entry.density.toFixed(2).padStart(9)}%`
  );
  return [header, divider, ...rows].join('\n');
}

export function computeKeywordDensityAnalysis(options: KeywordDensityOptions): KeywordDensityResult {
  const { inputText, topN, excludeStopWords } = options;
  if (!inputText) {
    return { keywords: [], output: '' };
  }

  const keywords = keywordDensity(inputText, topN, excludeStopWords);
  return {
    keywords,
    output: formatKeywordDensityTable(keywords)
  };
}

export function resolveKeywordDensitySuggestion(
  context: KeywordDensitySuggestionContext
): TuToolSuggestion | null {
  const { hasInput, keywordCount, excludeStopWords, topDensity, topWord } = context;

  if (!hasInput) {
    return {
      id: 'kd-get-started',
      title: 'Analyze keyword density?',
      reason:
        'Paste an article or draft to see the most frequent words and their share of total word count. Exclude stop words for clearer SEO signals.',
      actionLabel: 'Open Word & Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  if (keywordCount === 0) {
    return {
      id: 'kd-none',
      title: 'No keywords matched',
      reason:
        'Words need at least two letters (letters/digits/hyphens). Strip HTML first, or turn off Exclude stop words if the draft is mostly short function words.',
      actionLabel: 'Open HTML Tag Stripper',
      path: '/text-utilities/html-tag-stripper'
    };
  }

  if (!excludeStopWords && topDensity >= KEYWORD_DENSITY_HIGH_THRESHOLD) {
    return {
      id: 'kd-stop-words',
      title: 'Stop words may dominate the list',
      reason:
        'Exclude stop words is off, so common words can crowd the ranking. Enable the filter for a cleaner keyword view.',
      actionLabel: 'Open Readability Analyzer',
      path: '/text-utilities/readability-analyzer'
    };
  }

  if (topDensity >= KEYWORD_DENSITY_HIGH_THRESHOLD) {
    return {
      id: 'kd-high-density',
      title: `"${topWord}" is ${topDensity}% of words`,
      reason:
        'A single term this frequent can feel repetitive. Check readability next, or turn top phrases into URL slugs.',
      actionLabel: 'Open Readability Analyzer',
      path: '/text-utilities/readability-analyzer'
    };
  }

  return {
    id: 'kd-ready',
    title: `${keywordCount} keyword${keywordCount === 1 ? '' : 's'} ranked`,
    reason:
      'Copy the density table, count characters for publishing limits, or generate a slug from a top term.',
    actionLabel: 'Open Slug Generator',
    path: '/text-utilities/slug-generator'
  };
}
