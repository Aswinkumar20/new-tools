import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { LoremGenerationType, LoremGenerateOptions } from '../types/lorem-ipsum-generator.types';

export const LOREM_WORDS: ReadonlyArray<string> = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
  'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'ut',
  'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'dolor', 'in',
  'reprehenderit', 'voluptate', 'velit', 'esse', 'cillum', 'dolore', 'eu', 'fugiat', 'nulla',
  'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'in',
  'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
];

export const LOREM_DEFAULT_OPTIONS: LoremGenerateOptions = {
  type: 'paragraphs',
  count: 3,
  startWith: 'lorem'
};

export const LOREM_MAX_BY_TYPE: Readonly<Record<LoremGenerationType, number>> = {
  paragraphs: 50,
  words: 1000,
  sentences: 200
};

export const LOREM_ERROR_COUNT_MIN = 'Count must be at least 1.';
export const LOREM_ERROR_MAX_PARAGRAPHS = 'Maximum 50 paragraphs allowed.';
export const LOREM_ERROR_MAX_WORDS = 'Maximum 1000 words allowed.';
export const LOREM_ERROR_MAX_SENTENCES = 'Maximum 200 sentences allowed.';
export const LOREM_ERROR_COPY_FAILED = 'Failed to copy text to clipboard.';

/** Suggest character counter once output is substantial. */
export const LOREM_CHAR_COUNTER_THRESHOLD = 200;

export const LOREM_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Count words and characters in the generated placeholder text'
  },
  {
    label: 'Text Case Convertor',
    path: '/text-utilities/text-case-convertor',
    description: 'Change case of copied lorem text for UI mockups'
  },
  {
    label: 'Flashcard & Quiz Generator',
    path: '/fun-tools/flashcard-quiz-generator',
    description: 'Use placeholder Q&A while designing study decks'
  },
  {
    label: 'Markdown Previewer',
    path: '/file-viewers/markdown-previewer',
    description: 'Preview how filler paragraphs look in Markdown layouts'
  },
  {
    label: 'Typing Speed Test',
    path: '/fun-tools/typing-speed-test',
    description: 'Practice typing with generated filler passages'
  }
];
