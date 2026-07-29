import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  WCC_DIFFICULT_READABILITY_THRESHOLD,
  WCC_LONG_FORM_WORD_THRESHOLD,
} from '../constants/words-and-character-counter.constants';
import type {
  WccAdvancedMetrics,
  WccFreqItem,
  WccPhraseItem,
  WccSuggestionContext,
  WccTextBreakdown,
} from '../types/words-and-character-counter.types';

export function countCharsNoSpaces(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
      count++;
    }
  }
  return count;
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

export function calculateSentenceLengths(text: string): number[] {
  const sentences = text ? text.split(/[\.\!\?]+(?:\s|$)/).filter((s) => s.trim().length > 0) : [];
  return sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
}

export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

export function hashWords(words: string[]): number {
  let h = 5381;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    for (let j = 0; j < w.length; j++) {
      h = (h * 33) ^ w.charCodeAt(j);
    }
    h = (h * 33) ^ 124;
  }
  return h >>> 0;
}

export function calculateAdvancedMetrics(
  words: string[],
  sentenceCount: number,
  _syllables: number
): WccAdvancedMetrics {
  const wordsCount = words.length || 1;
  const sentencesCount = sentenceCount || 1;
  const complexWords = words.filter((w) => w.replace(/[^a-z]/gi, '').length > 6).length;
  const gunningFog =
    Math.round(0.4 * ((wordsCount / sentencesCount) + 100 * (complexWords / wordsCount)) * 10) / 10;
  const smog =
    Math.round((1.043 * Math.sqrt((complexWords * (30 / sentencesCount)) || 0) + 3.1291) * 10) / 10;
  const letters = words.join('').replace(/[^A-Za-z]/g, '').length;
  const L = (letters / wordsCount) * 100;
  const S = (sentencesCount / wordsCount) * 100;
  const colemanLiau = Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10;
  return { gunningFog, smog, colemanLiau };
}

export function roundMetric(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calculateWordFrequency(words: string[]): WccFreqItem[] {
  const freqMap: { [key: string]: number } = {};
  for (const word of words) {
    const w = word.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (!w) continue;
    freqMap[w] = (freqMap[w] || 0) + 1;
  }
  return Object.entries(freqMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

export function countSyllables(words: string[]): number {
  let syllables = 0;
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) continue;
    const matches = clean.match(/[aeiouy]{1,2}/g);
    syllables += matches ? matches.length : 1;
  }
  return syllables;
}

export function interpretReadabilityScore(score: number): string {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 60) return 'Fairly Easy';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
}

export function calculateFleschReadingEase(words: number, sentences: number, syllables: number): number {
  if (words === 0 || sentences === 0) return 0;
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(score * 10) / 10;
}

export function calculateFleschKincaidGrade(words: number, sentences: number, syllables: number): number {
  if (words === 0 || sentences === 0) return 0;
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.round(grade * 10) / 10;
}

export function calculateTextBreakdown(text: string): WccTextBreakdown {
  const breakdown: WccTextBreakdown = {
    letters: 0,
    digits: 0,
    punctuation: 0,
    spaces: 0,
    uppercase: 0,
    lowercase: 0,
    other: 0,
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      breakdown.letters++;
      if (code >= 65 && code <= 90) breakdown.uppercase++;
      else breakdown.lowercase++;
    } else if (code >= 48 && code <= 57) {
      breakdown.digits++;
    } else if (code === 32 || code === 9 || code === 10 || code === 13) {
      breakdown.spaces++;
    } else if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(ch)) {
      breakdown.punctuation++;
    } else {
      breakdown.other++;
    }
  }
  return breakdown;
}

export function calculateNGrams(words: string[], n: number): WccPhraseItem[] {
  if (words.length < n) return [];
  const normalized = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
  if (normalized.length < n) return [];
  const freqMap: Record<string, number> = {};
  for (let i = 0; i <= normalized.length - n; i++) {
    const slice = normalized.slice(i, i + n);
    if (slice.length < n || slice.some((part) => !part)) continue;
    const phrase = slice.join(' ');
    freqMap[phrase] = (freqMap[phrase] || 0) + 1;
  }
  return Object.entries(freqMap)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatReadingDuration(minutes: number, wordCount: number): string {
  if (!wordCount) return '—';
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countWordMatches(text: string, word: string): number {
  if (!text || !word) return 0;
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
  return (text.match(pattern) || []).length;
}

export function resolveWccSuggestion(context: WccSuggestionContext): TuToolSuggestion | null {
  const {
    hasContent,
    wordCount,
    sentenceCount,
    readabilityScore,
    uniqueWordCount,
    excludeStopWords,
  } = context;

  if (!hasContent) {
    return {
      id: 'wcc-get-started',
      title: 'Count words, characters, and readability?',
      reason:
        'Paste or upload a draft to see live counters, keyword density, phrases, and Flesch scores. Export CSV, PDF, or TXT when ready.',
      actionLabel: 'Open Readability Analyzer',
      path: '/text-utilities/readability-analyzer',
    };
  }

  if (sentenceCount === 0 && wordCount > 0) {
    return {
      id: 'wcc-no-sentences',
      title: 'No sentence endings detected',
      reason:
        'Add periods, question marks, or exclamation points so readability and average sentence length can be calculated.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (readabilityScore > 0 && readabilityScore <= WCC_DIFFICULT_READABILITY_THRESHOLD) {
    return {
      id: 'wcc-difficult-read',
      title: 'Draft looks difficult to read',
      reason: `Flesch score ${readabilityScore} suggests denser prose. Open Readability Analyzer for a focused review, or simplify sentences.`,
      actionLabel: 'Open Readability Analyzer',
      path: '/text-utilities/readability-analyzer',
    };
  }

  if (wordCount >= WCC_LONG_FORM_WORD_THRESHOLD) {
    return {
      id: 'wcc-long-form',
      title: 'Long-form draft detected',
      reason: `${wordCount} words — check Keyword Density for overused terms, or export frequency CSV for editors.`,
      actionLabel: 'Open Keyword Density',
      path: '/text-utilities/keyword-density',
    };
  }

  if (uniqueWordCount > 0 && uniqueWordCount === wordCount && wordCount >= 8 && !excludeStopWords) {
    return {
      id: 'wcc-all-unique',
      title: 'Every word appears once',
      reason:
        'No repeated terms yet. Keep drafting, or enable stop-word filtering on the Words tab to focus on content words.',
      actionLabel: 'Open Keyword Density',
      path: '/text-utilities/keyword-density',
    };
  }

  return {
    id: 'wcc-analyzed',
    title: `${wordCount} word${wordCount === 1 ? '' : 's'} analyzed`,
    reason:
      'Browse Words, Phrases, Breakdown, and Readability tabs. Copy stats, export CSV/PDF, or deepen analysis in related tools.',
    actionLabel: 'Open Readability Analyzer',
    path: '/text-utilities/readability-analyzer',
  };
}
