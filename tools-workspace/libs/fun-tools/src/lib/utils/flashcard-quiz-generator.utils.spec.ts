import {
  computeQuizProgress,
  computeQuizStats,
  createFlashcard,
  createFlashcardId,
  createQuizAnswer,
  deleteFlashcardFromList,
  resolveFlashcardQuizSuggestion,
  updateFlashcardInList,
  validateFlashcardSides
} from './flashcard-quiz-generator.utils';

describe('flashcard-quiz-generator.utils', () => {
  describe('createFlashcardId / createFlashcard', () => {
    it('builds legacy-style ids and trimmed cards', () => {
      expect(createFlashcardId(() => 1000, () => 0.123456789)).toContain('1000');
      const card = createFlashcard({ front: '  Q  ', back: '  A  ' }, () => 42, () => 0.5);
      expect(card.front).toBe('Q');
      expect(card.back).toBe('A');
      expect(card.createdAt).toBe(42);
    });
  });

  describe('validateFlashcardSides', () => {
    it('requires both sides', () => {
      expect(validateFlashcardSides({ front: '', back: 'a' })).toBe('Front side cannot be empty.');
      expect(validateFlashcardSides({ front: 'a', back: '  ' })).toBe('Back side cannot be empty.');
      expect(validateFlashcardSides({ front: 'a', back: 'b' })).toBeNull();
    });
  });

  describe('list helpers and stats', () => {
    const base = createFlashcard({ front: 'Q1', back: 'A1' }, () => 1, () => 0.1);

    it('updates and deletes cards', () => {
      const updated = updateFlashcardInList([base], base.id, { front: 'Q2', back: 'A2' });
      expect(updated[0].front).toBe('Q2');
      expect(deleteFlashcardFromList(updated, base.id)).toEqual([]);
    });

    it('computes progress and accuracy', () => {
      expect(computeQuizProgress(1, 4)).toBe(25);
      expect(computeQuizProgress(0, 0)).toBe(0);
      expect(
        computeQuizStats([
          createQuizAnswer('1', true, () => 1),
          createQuizAnswer('2', false, () => 2)
        ])
      ).toEqual({ total: 2, correct: 1, incorrect: 1, accuracy: 50 });
    });
  });

  describe('resolveFlashcardQuizSuggestion', () => {
    it('suggests lorem when empty and more cards when short', () => {
      expect(
        resolveFlashcardQuizSuggestion({
          cardCount: 0,
          quizMode: false,
          isQuizComplete: false,
          accuracy: 0,
          answeredCount: 0
        })?.id
      ).toBe('fqg-lorem');
      expect(
        resolveFlashcardQuizSuggestion({
          cardCount: 1,
          quizMode: false,
          isQuizComplete: false,
          accuracy: 0,
          answeredCount: 0
        })?.id
      ).toBe('fqg-need-more');
    });

    it('suggests pomodoro after a weak completed quiz', () => {
      expect(
        resolveFlashcardQuizSuggestion({
          cardCount: 4,
          quizMode: true,
          isQuizComplete: true,
          accuracy: 50,
          answeredCount: 4
        })?.id
      ).toBe('fqg-pomodoro');
    });
  });
});
