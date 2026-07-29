import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  LOREM_CHAR_COUNTER_THRESHOLD,
  LOREM_ERROR_COUNT_MIN,
  LOREM_ERROR_MAX_PARAGRAPHS,
  LOREM_ERROR_MAX_SENTENCES,
  LOREM_ERROR_MAX_WORDS,
  LOREM_MAX_BY_TYPE,
  LOREM_WORDS
} from '../constants/lorem-ipsum-generator.constants';
import type {
  LoremGenerationType,
  LoremGenerateOptions,
  LoremStartWith,
  LoremTextStats
} from '../types/lorem-ipsum-generator.types';

export function validateLoremCount(type: LoremGenerationType, count: number): string | null {
  if (count < 1) {
    return LOREM_ERROR_COUNT_MIN;
  }
  if (type === 'paragraphs' && count > LOREM_MAX_BY_TYPE.paragraphs) {
    return LOREM_ERROR_MAX_PARAGRAPHS;
  }
  if (type === 'words' && count > LOREM_MAX_BY_TYPE.words) {
    return LOREM_ERROR_MAX_WORDS;
  }
  if (type === 'sentences' && count > LOREM_MAX_BY_TYPE.sentences) {
    return LOREM_ERROR_MAX_SENTENCES;
  }
  return null;
}

export function maxCountForType(type: LoremGenerationType): number {
  return LOREM_MAX_BY_TYPE[type];
}

export function computeLoremStats(text: string): LoremTextStats {
  if (!text) {
    return { words: 0, characters: 0, paragraphs: 0, sentences: 0 };
  }
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const characters = text.length;
  const paragraphs = text.split(/\n\n/).filter((p) => p.trim().length > 0).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  return { words, characters, paragraphs, sentences };
}

function pickWord(wordList: readonly string[], random: () => number): string {
  return wordList[Math.floor(random() * wordList.length)];
}

export function generateLoremWords(
  count: number,
  startWith: LoremStartWith,
  random: (() => number) = Math.random
): string {
  const words: string[] = [];
  const wordList = [...LOREM_WORDS];
  let remaining = count;
  if (startWith === 'lorem' && remaining > 0) {
    words.push('Lorem');
    remaining--;
  }
  for (let i = 0; i < remaining; i++) {
    words.push(pickWord(wordList, random));
  }
  return words.join(' ');
}

export function generateLoremSentences(
  count: number,
  startWith: LoremStartWith,
  random: (() => number) = Math.random
): string {
  const sentences: string[] = [];
  const wordList = [...LOREM_WORDS];
  for (let i = 0; i < count; i++) {
    const wordCount = 8 + Math.floor(random() * 12);
    const words: string[] = [];
    if (i === 0 && startWith === 'lorem') {
      words.push('Lorem', 'ipsum');
      for (let j = 0; j < wordCount - 2; j++) {
        words.push(pickWord(wordList, random));
      }
    } else {
      for (let j = 0; j < wordCount; j++) {
        const word = pickWord(wordList, random);
        words.push(j === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word);
      }
    }
    sentences.push(words.join(' ') + '.');
  }
  return sentences.join(' ');
}

export function generateLoremParagraphs(
  count: number,
  startWith: LoremStartWith,
  random: (() => number) = Math.random
): string {
  const paragraphs: string[] = [];
  for (let i = 0; i < count; i++) {
    const sentenceCount = 3 + Math.floor(random() * 5);
    paragraphs.push(generateLoremSentences(sentenceCount, i === 0 ? startWith : 'random', random));
  }
  return paragraphs.join('\n\n');
}

export function generateLoremText(
  options: LoremGenerateOptions,
  random: (() => number) = Math.random
): string {
  switch (options.type) {
    case 'paragraphs':
      return generateLoremParagraphs(options.count, options.startWith, random);
    case 'words':
      return generateLoremWords(options.count, options.startWith, random);
    case 'sentences':
      return generateLoremSentences(options.count, options.startWith, random);
  }
}

export function resolveLoremSuggestion(options: {
  hasText: boolean;
  hasError: boolean;
  type: LoremGenerationType;
  characterCount: number;
  wordCount: number;
}): FtToolSuggestion | null {
  const { hasText, hasError, type, characterCount, wordCount } = options;

  if (hasError) {
    return {
      id: 'lig-limits',
      title: 'Count is over the limit',
      reason:
        'Lower the count to the documented maximums (50 paragraphs, 1000 words, or 200 sentences), then generate again.',
      actionLabel: 'Open Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  if (!hasText) {
    return {
      id: 'lig-flashcards',
      title: 'Building UI or quiz mockups?',
      reason:
        'Generate filler here, then drop short snippets into Flashcard & Quiz Generator while designing decks.',
      actionLabel: 'Open Flashcard & Quiz Generator',
      path: '/fun-tools/flashcard-quiz-generator'
    };
  }

  if (characterCount >= LOREM_CHAR_COUNTER_THRESHOLD) {
    return {
      id: 'lig-counter',
      title: 'Check word and character counts?',
      reason:
        'Paste this output into Character Counter to verify lengths for forms, bios, or layout constraints.',
      actionLabel: 'Open Character Counter',
      path: '/text-utilities/character-counter'
    };
  }

  if (type === 'paragraphs') {
    return {
      id: 'lig-markdown',
      title: 'Preview paragraphs in Markdown?',
      reason:
        'Wrap filler paragraphs in Markdown headings and lists, then preview layout in Markdown Previewer.',
      actionLabel: 'Open Markdown Previewer',
      path: '/file-viewers/markdown-previewer'
    };
  }

  if (type === 'words' && wordCount > 0) {
    return {
      id: 'lig-case',
      title: 'Need a different text case?',
      reason:
        'Copy the words, then use Text Case Convertor for title case, UPPERCASE, or camelCase mock data.',
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor'
    };
  }

  return {
    id: 'lig-typing',
    title: 'Use this as a typing passage?',
    reason:
      'Generated sentences make quick practice text for Typing Speed Test without hunting for a sample.',
    actionLabel: 'Open Typing Speed Test',
    path: '/fun-tools/typing-speed-test'
  };
}
