export type WccInsightTab = 'frequency' | 'phrases' | 'breakdown' | 'readability';

export interface WccTextBreakdown {
  letters: number;
  digits: number;
  punctuation: number;
  spaces: number;
  uppercase: number;
  lowercase: number;
  other: number;
}

export interface WccFreqItem {
  word: string;
  count: number;
}

export interface WccPhraseItem {
  phrase: string;
  count: number;
}

export interface WccDensityItem {
  word: string;
  count: number;
  density: number;
}

export interface WccWorkerMessage {
  words: string[];
  syllables: number;
  wordFrequency: { word: string; count: number }[];
  sentenceLengths?: number[];
  advanced?: {
    gunningFog: number;
    smog: number;
    colemanLiau: number;
  };
}

export interface WccAdvancedMetrics {
  gunningFog: number;
  smog: number;
  colemanLiau: number;
}

export interface WccSuggestionContext {
  hasContent: boolean;
  wordCount: number;
  sentenceCount: number;
  readabilityScore: number;
  uniqueWordCount: number;
  excludeStopWords: boolean;
}
