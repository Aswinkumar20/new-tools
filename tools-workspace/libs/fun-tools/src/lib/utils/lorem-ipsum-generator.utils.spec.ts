import {
  computeLoremStats,
  generateLoremParagraphs,
  generateLoremSentences,
  generateLoremText,
  generateLoremWords,
  maxCountForType,
  resolveLoremSuggestion,
  validateLoremCount
} from './lorem-ipsum-generator.utils';

describe('lorem-ipsum-generator.utils', () => {
  const fixedRandom = () => 0.25;

  describe('validateLoremCount / maxCountForType', () => {
    it('enforces legacy limits and messages', () => {
      expect(validateLoremCount('paragraphs', 0)).toBe('Count must be at least 1.');
      expect(validateLoremCount('paragraphs', 51)).toBe('Maximum 50 paragraphs allowed.');
      expect(validateLoremCount('words', 1001)).toBe('Maximum 1000 words allowed.');
      expect(validateLoremCount('sentences', 201)).toBe('Maximum 200 sentences allowed.');
      expect(validateLoremCount('words', 10)).toBeNull();
      expect(maxCountForType('paragraphs')).toBe(50);
      expect(maxCountForType('words')).toBe(1000);
      expect(maxCountForType('sentences')).toBe(200);
    });
  });

  describe('generation', () => {
    it('starts words with Lorem when requested', () => {
      expect(generateLoremWords(3, 'lorem', fixedRandom).startsWith('Lorem ')).toBe(true);
      expect(generateLoremWords(2, 'random', fixedRandom).split(' ').length).toBe(2);
    });

    it('starts sentences with Lorem ipsum when requested', () => {
      const text = generateLoremSentences(1, 'lorem', fixedRandom);
      expect(text.startsWith('Lorem ipsum')).toBe(true);
      expect(text.endsWith('.')).toBe(true);
    });

    it('joins paragraphs with blank lines', () => {
      const text = generateLoremParagraphs(2, 'lorem', fixedRandom);
      expect(text.split('\n\n').length).toBe(2);
    });

    it('dispatches by type', () => {
      expect(generateLoremText({ type: 'words', count: 4, startWith: 'random' }, fixedRandom).split(' ').length).toBe(4);
    });
  });

  describe('computeLoremStats', () => {
    it('counts empty and non-empty text', () => {
      expect(computeLoremStats('')).toEqual({ words: 0, characters: 0, paragraphs: 0, sentences: 0 });
      const stats = computeLoremStats('Hello world. Next!\n\nSecond para.');
      expect(stats.words).toBe(5);
      expect(stats.paragraphs).toBe(2);
      expect(stats.sentences).toBe(3);
    });
  });

  describe('resolveLoremSuggestion', () => {
    it('suggests flashcards when empty and counter for long text', () => {
      expect(
        resolveLoremSuggestion({
          hasText: false,
          hasError: false,
          type: 'paragraphs',
          characterCount: 0,
          wordCount: 0
        })?.id
      ).toBe('lig-flashcards');
      expect(
        resolveLoremSuggestion({
          hasText: true,
          hasError: false,
          type: 'words',
          characterCount: 250,
          wordCount: 40
        })?.id
      ).toBe('lig-counter');
    });
  });
});
