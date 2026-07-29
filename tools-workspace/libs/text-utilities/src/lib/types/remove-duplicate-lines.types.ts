export type DedupMode = 'words' | 'lines' | 'both';
export type KeepOccurrence = 'first' | 'last';
export type EmptyLineMode = 'keep' | 'remove' | 'collapse';
export type CsvDedupeMode = 'whole' | 'first-column';
export type UnicodeForm = 'none' | 'NFC' | 'NFD';
export type RemoveDuplicateSidebarTab = 'highlights' | 'duplicates' | 'phrases' | 'diff';

export interface DedupOptions {
  mode: DedupMode;
  caseSensitive: boolean;
  ignorePunctuation: boolean;
  trimTokens: boolean;
  keepOccurrence: KeepOccurrence;
  preserveLineBreaks: boolean;
  ignoreStopWords: boolean;
  detectPhrases: boolean;
  phraseMinLength: 2 | 3;
  unicodeForm: UnicodeForm;
  locale: string;
  emptyLines: EmptyLineMode;
  csvMode: CsvDedupeMode;
}

export interface DuplicateEntry {
  key: string;
  occurrences: number;
  removed: number;
}

export interface PhraseDuplicate {
  phrase: string;
  count: number;
}

export interface DedupResult {
  output: string;
  removedItems: string[];
  duplicateEntries: DuplicateEntry[];
  phraseDuplicates: PhraseDuplicate[];
  uniqueDuplicateKeys: number;
  totalRemoved: number;
  wordsBefore: number;
  wordsAfter: number;
  linesBefore: number;
  linesAfter: number;
  reductionPct: number;
  sidebarHighlightHtml: string;
  sourceHighlightHtml: string;
  diffHtml: string;
}

export interface RemoveDuplicateSuggestionContext {
  hasInput: boolean;
  mode: DedupMode;
  csvMode: CsvDedupeMode;
  removedCount: number;
  duplicateCount: number;
  reductionPct: number;
  inputLooksLikeCsv: boolean;
  exactDuplicateLineCount: number;
}
