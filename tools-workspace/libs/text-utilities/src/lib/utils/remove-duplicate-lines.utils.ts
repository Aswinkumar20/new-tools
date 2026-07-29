import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { STOP_WORDS } from '../constants/remove-duplicate-lines.constants';
import type {
  DedupOptions,
  DedupResult,
  DuplicateEntry,
  PhraseDuplicate,
  RemoveDuplicateSuggestionContext,
  UnicodeForm,
} from '../types/remove-duplicate-lines.types';

export type {
  CsvDedupeMode,
  DedupMode,
  DedupOptions,
  DedupResult,
  DuplicateEntry,
  EmptyLineMode,
  KeepOccurrence,
  PhraseDuplicate,
  RemoveDuplicateSidebarTab,
  RemoveDuplicateSuggestionContext,
  UnicodeForm,
} from '../types/remove-duplicate-lines.types';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyUnicode(text: string, form: UnicodeForm): string {
  if (form === 'none' || !text) return text;
  return text.normalize(form);
}

function normalizeToken(token: string, options: DedupOptions): string {
  let t = applyUnicode(token, options.unicodeForm);
  if (options.trimTokens) t = t.trim();
  if (options.ignorePunctuation) {
    t = t.replace(/^[^\w]+|[^\w]+$/gu, '');
  }
  if (!options.caseSensitive) {
    t = t.toLocaleLowerCase(options.locale);
  }
  return t;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

function tokenizeWithSpans(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /\S+/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function isStopWord(normalized: string, options: DedupOptions): boolean {
  return options.ignoreStopWords && STOP_WORDS.has(normalized.toLocaleLowerCase(options.locale));
}

function dedupeWords(text: string, options: DedupOptions): {
  output: string;
  removed: string[];
  duplicateKeys: Map<string, { occurrences: number; removed: number }>;
  markDuplicate: Set<number>;
} {
  const removed: string[] = [];
  const duplicateKeys = new Map<string, { occurrences: number; removed: number }>();
  const markDuplicate = new Set<number>();

  if (options.preserveLineBreaks) {
    const lines = text.split('\n');
    const outLines = lines.map((line) => {
      const r = dedupeWordsInSegment(line, options, removed, duplicateKeys, markDuplicate, 0);
      return r.text;
    });
    return { output: outLines.join('\n'), removed, duplicateKeys, markDuplicate };
  }

  const r = dedupeWordsInSegment(text, options, removed, duplicateKeys, markDuplicate, 0);
  return { output: r.text, removed, duplicateKeys, markDuplicate };
}

function dedupeWordsInSegment(
  text: string,
  options: DedupOptions,
  removed: string[],
  duplicateKeys: Map<string, { occurrences: number; removed: number }>,
  markDuplicate: Set<number>,
  offsetBase: number
): { text: string } {
  const tokens = tokenizeWithSpans(text);
  if (!tokens.length) return { text };

  const keepSet = new Set<number>();
  const normalizedList = tokens.map((t) => normalizeToken(t.word, options));

  if (options.keepOccurrence === 'first') {
    const seen = new Set<string>();
    tokens.forEach((t, i) => {
      const key = normalizedList[i];
      if (!key || isStopWord(key, options)) {
        keepSet.add(i);
        return;
      }
      if (seen.has(key)) {
        removed.push(t.word);
        markDuplicate.add(offsetBase + t.start);
        const entry = duplicateKeys.get(key) ?? { occurrences: 0, removed: 0 };
        entry.occurrences += 1;
        entry.removed += 1;
        duplicateKeys.set(key, entry);
      } else {
        seen.add(key);
        keepSet.add(i);
        const entry = duplicateKeys.get(key) ?? { occurrences: 0, removed: 0 };
        entry.occurrences += 1;
        duplicateKeys.set(key, entry);
      }
    });
  } else {
    const lastIndex = new Map<string, number>();
    normalizedList.forEach((key, i) => {
      if (key && !isStopWord(key, options)) lastIndex.set(key, i);
    });
    tokens.forEach((t, i) => {
      const key = normalizedList[i];
      if (!key || isStopWord(key, options)) {
        keepSet.add(i);
        return;
      }
      if (lastIndex.get(key) === i) {
        keepSet.add(i);
        const entry = duplicateKeys.get(key) ?? { occurrences: 0, removed: 0 };
        entry.occurrences += 1;
        duplicateKeys.set(key, entry);
      } else {
        removed.push(t.word);
        markDuplicate.add(offsetBase + t.start);
        const entry = duplicateKeys.get(key) ?? { occurrences: 0, removed: 0 };
        entry.occurrences += 1;
        entry.removed += 1;
        duplicateKeys.set(key, entry);
      }
    });
  }

  let result = '';
  let lastEnd = 0;
  tokens.forEach((t, i) => {
    if (keepSet.has(i)) {
      result += text.slice(lastEnd, t.end);
      lastEnd = t.end;
    } else {
      lastEnd = t.end;
    }
  });
  result += text.slice(lastEnd);
  const trimmed = options.trimTokens ? result.trimStart() : result;
  return { text: trimmed };
}

function normalizeLine(line: string, options: DedupOptions): string {
  let l = applyUnicode(line, options.unicodeForm);
  if (options.trimTokens) l = l.trim();
  if (options.ignorePunctuation) {
    l = l.replace(/[^\w\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!options.caseSensitive) {
    l = l.toLocaleLowerCase(options.locale);
  }
  return l;
}

function lineDedupeKey(line: string, options: DedupOptions): string {
  if (options.csvMode === 'first-column' && line.includes(',')) {
    const first = line.split(',')[0] ?? line;
    return normalizeLine(first, options);
  }
  return normalizeLine(line, options);
}

function dedupeLines(text: string, options: DedupOptions): {
  output: string;
  removed: string[];
  duplicateKeys: Map<string, { occurrences: number; removed: number }>;
} {
  const lines = text.split('\n');
  const removed: string[] = [];
  const duplicateKeys = new Map<string, { occurrences: number; removed: number }>();

  const processed = lines.map((line) => {
    if (!line.trim() && options.emptyLines === 'remove') return null;
    return line;
  });

  let working = processed.filter((l): l is string => l !== null);
  if (options.emptyLines === 'collapse') {
    const collapsed: string[] = [];
    let prevEmpty = false;
    for (const line of lines) {
      const isEmpty = !line.trim();
      if (isEmpty) {
        if (!prevEmpty) collapsed.push(line);
        prevEmpty = true;
      } else {
        collapsed.push(line);
        prevEmpty = false;
      }
    }
    working = collapsed;
  }

  const indices = options.keepOccurrence === 'first'
    ? working.map((_, i) => i)
    : working.map((_, i) => i).reverse();

  const keepIndices = new Set<number>();
  const seen = new Set<string>();

  for (const i of indices) {
    const line = working[i];
    const key = lineDedupeKey(line, options);
    if (!key && options.emptyLines !== 'keep') {
      keepIndices.add(i);
      continue;
    }
    const entry = duplicateKeys.get(key) ?? { occurrences: 0, removed: 0 };
    entry.occurrences += 1;
    if (seen.has(key)) {
      entry.removed += 1;
      removed.push(line);
      duplicateKeys.set(key, entry);
    } else {
      seen.add(key);
      keepIndices.add(i);
      duplicateKeys.set(key, entry);
    }
  }

  const output = working
    .filter((_, i) => keepIndices.has(i))
    .join('\n');

  return { output, removed, duplicateKeys };
}

function findPhraseDuplicates(text: string, options: DedupOptions): PhraseDuplicate[] {
  if (!options.detectPhrases) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  const len = options.phraseMinLength;

  for (let i = 0; i <= words.length - len; i++) {
    const slice = words.slice(i, i + len);
    const phrase = slice
      .map((w) => normalizeToken(w, options))
      .filter(Boolean)
      .join(' ');
    if (!phrase) continue;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

function buildSourceHighlight(text: string, duplicateKeys: Map<string, { occurrences: number; removed: number }>, options: DedupOptions): string {
  if (!text) return '';
  const dupNormalized = new Set(
    Array.from(duplicateKeys.entries())
      .filter(([, v]) => v.removed > 0)
      .map(([k]) => k)
  );

  const tokens = tokenizeWithSpans(text);
  const seen = new Map<string, number>();
  let html = '';
  let lastEnd = 0;

  for (const t of tokens) {
    html += escapeHtml(text.slice(lastEnd, t.start));
    const norm = normalizeToken(t.word, options);
    const isDup = norm && dupNormalized.has(norm) && (seen.get(norm) ?? 0) > 0;
    if (norm) seen.set(norm, (seen.get(norm) ?? 0) + 1);

    if (isDup) {
      html += `<mark>${escapeHtml(t.word)}</mark>`;
    } else {
      html += escapeHtml(t.word);
    }
    lastEnd = t.end;
  }
  html += escapeHtml(text.slice(lastEnd));
  return html + '\n';
}

function buildSidebarHighlight(text: string, options: DedupOptions, duplicateKeys: Map<string, { occurrences: number; removed: number }>): string {
  return buildSourceHighlight(text, duplicateKeys, options);
}

function buildDiffHtml(text: string, removedWords: string[], options: DedupOptions): string {
  if (!text || !removedWords.length) return escapeHtml(text);

  const removedSet = new Set(removedWords);
  const tokens = tokenizeWithSpans(text);
  let html = '';
  let lastEnd = 0;

  for (const t of tokens) {
    html += escapeHtml(text.slice(lastEnd, t.start));
    const norm = normalizeToken(t.word, options);
    const isRemoved = removedSet.has(t.word) || (norm && duplicateRemovedToken(t.word, removedWords, options));
    if (isRemoved) {
      html += `<del>${escapeHtml(t.word)}</del>`;
    } else {
      html += escapeHtml(t.word);
    }
    lastEnd = t.end;
  }
  html += escapeHtml(text.slice(lastEnd));
  return html;
}

function duplicateRemovedToken(word: string, removed: string[], options: DedupOptions): boolean {
  const norm = normalizeToken(word, options);
  return removed.some((r) => normalizeToken(r, options) === norm);
}

export function deduplicateText(text: string, options: DedupOptions): DedupResult {
  const input = applyUnicode(text, options.unicodeForm);
  const wordsBefore = countWords(input);
  const linesBefore = countLines(input);

  if (!input.trim()) {
    return {
      output: '',
      removedItems: [],
      duplicateEntries: [],
      phraseDuplicates: [],
      uniqueDuplicateKeys: 0,
      totalRemoved: 0,
      wordsBefore: 0,
      wordsAfter: 0,
      linesBefore: 0,
      linesAfter: 0,
      reductionPct: 0,
      sidebarHighlightHtml: '',
      sourceHighlightHtml: '',
      diffHtml: '',
    };
  }

  let output = input;
  const allRemoved: string[] = [];
  const allDuplicateKeys = new Map<string, { occurrences: number; removed: number }>();

  const mergeKeys = (src: Map<string, { occurrences: number; removed: number }>) => {
    for (const [k, v] of src) {
      const existing = allDuplicateKeys.get(k) ?? { occurrences: 0, removed: 0 };
      existing.occurrences += v.occurrences;
      existing.removed += v.removed;
      allDuplicateKeys.set(k, existing);
    }
  };

  if (options.mode === 'words' || options.mode === 'both') {
    const wr = dedupeWords(output, options);
    output = wr.output;
    allRemoved.push(...wr.removed);
    mergeKeys(wr.duplicateKeys);
  }

  if (options.mode === 'lines' || options.mode === 'both') {
    const lr = dedupeLines(output, options);
    output = lr.output;
    allRemoved.push(...lr.removed);
    mergeKeys(lr.duplicateKeys);
  }

  const wordsAfter = countWords(output);
  const linesAfter = countLines(output);
  const totalRemoved = allRemoved.length;
  const uniqueDuplicateKeys = Array.from(allDuplicateKeys.values()).filter((v) => v.removed > 0).length;
  const inputLen = input.length || 1;
  const reductionPct = Math.round(((inputLen - output.length) / inputLen) * 100);

  const duplicateEntries: DuplicateEntry[] = Array.from(allDuplicateKeys.entries())
    .filter(([, v]) => v.removed > 0)
    .map(([key, v]) => ({ key, occurrences: v.occurrences, removed: v.removed }))
    .sort((a, b) => b.removed - a.removed);

  const phraseDuplicates = findPhraseDuplicates(input, options);

  return {
    output,
    removedItems: allRemoved,
    duplicateEntries,
    phraseDuplicates,
    uniqueDuplicateKeys,
    totalRemoved,
    wordsBefore,
    wordsAfter,
    linesBefore,
    linesAfter,
    reductionPct: Math.max(0, reductionPct),
    sidebarHighlightHtml: buildSidebarHighlight(input, options, allDuplicateKeys),
    sourceHighlightHtml: buildSourceHighlight(input, allDuplicateKeys, options),
    diffHtml: buildDiffHtml(input, allRemoved, options),
  };
}

/** Heuristic: most non-empty lines look like comma-separated rows. */
export function inputLooksLikeCsvRows(text: string): boolean {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return false;
  }
  const withComma = lines.filter((line) => line.includes(',')).length;
  return withComma / lines.length >= 0.7;
}

/** Count how many lines are exact repeats of an earlier line. */
export function countExactDuplicateLines(text: string): number {
  const seen = new Set<string>();
  let duplicateLineCount = 0;
  for (const line of text.split('\n')) {
    if (seen.has(line)) {
      duplicateLineCount += 1;
    } else {
      seen.add(line);
    }
  }
  return duplicateLineCount;
}

export function resolveRemoveDuplicateLinesSuggestion(
  context: RemoveDuplicateSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    mode,
    csvMode,
    removedCount,
    duplicateCount,
    reductionPct,
    inputLooksLikeCsv,
    exactDuplicateLineCount,
  } = context;

  if (!hasInput) {
    return {
      id: 'rdl-get-started',
      title: 'Remove duplicate words or lines?',
      reason:
        'Paste a list, log, or prose. Choose Words, Lines, or Both — duplicates highlight live as you type.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (inputLooksLikeCsv && csvMode === 'whole' && (mode === 'lines' || mode === 'both')) {
    return {
      id: 'rdl-csv-rows',
      title: 'CSV-style rows detected',
      reason:
        'Most lines look comma-separated. Open Options and set CSV to First column to dedupe by the first field only.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (mode === 'words' && exactDuplicateLineCount >= 2) {
    return {
      id: 'rdl-duplicate-lines',
      title: 'Repeated whole lines detected',
      reason:
        'Several identical lines appear. Switch to Lines or Both mode to remove duplicate rows, not only repeated words.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (removedCount > 0) {
    return {
      id: 'rdl-cleaned',
      title: `${removedCount} duplicate${removedCount === 1 ? '' : 's'} removed (${reductionPct}% smaller)`,
      reason:
        'Apply moves cleanup into Source. Sort or number the cleaned list next, or export via Copy / TXT / JSON.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (hasInput && duplicateCount === 0) {
    return {
      id: 'rdl-already-clean',
      title: 'No duplicates found',
      reason:
        'Text looks unique under current options. Try Lines mode, case sensitivity, or trim whitespace if results surprise you.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  return {
    id: 'rdl-ready',
    title: 'Ready to clean',
    reason:
      'Open Options for case, punctuation, CSV first column, and empty-line handling. Selection previews cleanup on highlighted text only.',
    actionLabel: 'Open Line Number Tool',
    path: '/text-utilities/line-number-tool',
  };
}
