import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { levenshteinDistance, similarityPercent } from '../shared/text-transform.utils';
import {
  TEXT_SIMILARITY_LOW_MATCH_PERCENT,
  TEXT_SIMILARITY_NEAR_MATCH_PERCENT,
} from '../constants/text-similarity.constants';
import type {
  TextSimilarityResult,
  TextSimilaritySuggestionContext,
} from '../types/text-similarity.types';

export function computeTextSimilarity(textA: string, textB: string): TextSimilarityResult {
  const similarity = similarityPercent(textA, textB);
  const distance = levenshteinDistance(textA, textB);
  const report = [
    `Similarity: ${similarity}%`,
    `Levenshtein distance: ${distance}`,
    '',
    `Text A length: ${textA.length} chars`,
    `Text B length: ${textB.length} chars`,
  ].join('\n');

  return { similarity, distance, report };
}

export function resolveTextSimilaritySuggestion(
  context: TextSimilaritySuggestionContext
): TuToolSuggestion | null {
  const { hasTextA, hasTextB, similarity, distance, lengthA, lengthB } = context;

  if (!hasTextA && !hasTextB) {
    return {
      id: 'tsim-get-started',
      title: 'Compare two strings side by side?',
      reason:
        'Paste Text A and Text B to get a similarity percentage and Levenshtein edit distance. Both empty strings score 100%.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference',
    };
  }

  if (hasTextA !== hasTextB) {
    return {
      id: 'tsim-need-both',
      title: 'Add the other text to finish the comparison',
      reason:
        'Similarity and distance need both sides. Fill the empty field — scores still update live as you type.',
      actionLabel: 'Open Find & Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (similarity === 100) {
    return {
      id: 'tsim-identical',
      title: 'Strings are identical',
      reason:
        'Similarity is 100% with zero edits. If you need a structured diff later, Text Difference is ready when they diverge.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference',
    };
  }

  if (similarity >= TEXT_SIMILARITY_NEAR_MATCH_PERCENT) {
    return {
      id: 'tsim-near-match',
      title: 'Near match detected',
      reason: `About ${similarity}% similar (${distance} edits). Use Text Difference for a line-level view of what still differs.`,
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference',
    };
  }

  if (similarity <= TEXT_SIMILARITY_LOW_MATCH_PERCENT) {
    return {
      id: 'tsim-low-match',
      title: 'Low overlap between the texts',
      reason: `Only ${similarity}% similar across ${Math.max(lengthA, lengthB)} max characters. Normalize casing or run Find & Replace if formatting noise is inflating distance.`,
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor',
    };
  }

  return {
    id: 'tsim-compared',
    title: 'Comparison ready',
    reason: `Similarity ${similarity}% · ${distance} edit(s). Copy or download the summary, or refine text with Find & Replace.`,
    actionLabel: 'Open Find & Replace',
    path: '/text-utilities/find-and-replace',
  };
}
