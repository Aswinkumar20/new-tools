import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  analyzeReadability,
  type ReadabilityResult
} from '../shared/text-transform.utils';
import {
  READABILITY_DIFFICULT_THRESHOLD,
  READABILITY_EASY_THRESHOLD
} from '../constants/readability-analyzer.constants';
import type {
  ReadabilityAnalysisResult,
  ReadabilitySuggestionContext
} from '../types/readability-analyzer.types';

export function formatReadabilityReport(result: ReadabilityResult): string {
  if (!result.words) {
    return '';
  }
  return [
    'Readability Report',
    '==================',
    '',
    `Words: ${result.words}`,
    `Sentences: ${result.sentences}`,
    `Syllables: ${result.syllables}`,
    '',
    `Flesch Reading Ease: ${result.fleschReadingEase}`,
    `Flesch-Kincaid Grade: ${result.fleschKincaidGrade}`,
    `Reading Level: ${result.readingLevel}`,
    '',
    `Avg words per sentence: ${result.avgWordsPerSentence}`,
    `Avg syllables per word: ${result.avgSyllablesPerWord}`
  ].join('\n');
}

export function computeReadabilityAnalysis(inputText: string): ReadabilityAnalysisResult {
  if (!inputText) {
    return { readability: null, output: '' };
  }

  const readability = analyzeReadability(inputText);
  return {
    readability,
    output: formatReadabilityReport(readability)
  };
}

export function resolveReadabilitySuggestion(
  context: ReadabilitySuggestionContext
): TuToolSuggestion | null {
  const { hasInput, wordCount, fleschReadingEase, readingLevel } = context;

  if (!hasInput) {
    return {
      id: 'ra-get-started',
      title: 'Analyze reading ease?',
      reason:
        'Paste prose to measure Flesch Reading Ease, Flesch-Kincaid grade, and average sentence complexity.',
      actionLabel: 'Open Word & Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  if (wordCount === 0) {
    return {
      id: 'ra-no-words',
      title: 'No words detected',
      reason:
        'Scores need letter/number tokens. Strip HTML or paste sentences with punctuation for accurate sentence counts.',
      actionLabel: 'Open HTML Tag Stripper',
      path: '/text-utilities/html-tag-stripper'
    };
  }

  if (fleschReadingEase < READABILITY_DIFFICULT_THRESHOLD) {
    return {
      id: 'ra-difficult',
      title: `Difficult reading — ${readingLevel}`,
      reason:
        'Long sentences or dense syllables lower Flesch scores. Check keyword density and trim fluff to simplify.',
      actionLabel: 'Open Keyword Density',
      path: '/text-utilities/keyword-density'
    };
  }

  if (fleschReadingEase >= READABILITY_EASY_THRESHOLD) {
    return {
      id: 'ra-easy',
      title: `Easy to read — ${readingLevel}`,
      reason:
        'This draft scores as accessible. Count characters for publishing limits, or review keyword focus next.',
      actionLabel: 'Open Word & Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  return {
    id: 'ra-ready',
    title: `Standard range — ${readingLevel}`,
    reason:
      'Copy the summary report, normalize whitespace if sentence breaks look off, or dig into word frequency.',
    actionLabel: 'Open Keyword Density',
    path: '/text-utilities/keyword-density'
  };
}
