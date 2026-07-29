import {
  computeAverageWpm,
  computeBestWpm,
  computeTypingLiveStats,
  createTypingTestResult,
  formatTypingClock,
  formatTypingResultsSummary,
  isTypingPassageComplete,
  prependTypingResult,
  resolveTypingSuggestion,
  typingCharacterClassName
} from './typing-speed-test.utils';

describe('typing-speed-test.utils', () => {
  describe('computeTypingLiveStats', () => {
    it('returns zeros until typing has elapsed time', () => {
      expect(computeTypingLiveStats('hello', 'hello world', 0)).toEqual({
        wpm: 0,
        accuracy: 0,
        characters: 0,
        correct: 0,
        incorrect: 0
      });
    });

    it('counts correct/incorrect and preserves WPM formula', () => {
      const stats = computeTypingLiveStats('heXlo', 'hello', 60);
      expect(stats.characters).toBe(5);
      expect(stats.correct).toBe(4);
      expect(stats.incorrect).toBe(1);
      expect(stats.accuracy).toBe(80);
      // Existing formula: (words / minutes) * 60 with minutes = seconds / 60
      // 1 word in 60s → (1 / 1) * 60 = 60
      expect(stats.wpm).toBe(60);
    });
  });

  describe('results helpers', () => {
    it('creates, prepends, and summarizes results', () => {
      const result = createTypingTestResult(
        { wpm: 40, accuracy: 95, characters: 10, correct: 9, incorrect: 1 },
        12.5,
        () => 99
      );
      expect(result.timestamp).toBe(99);
      expect(prependTypingResult([result], { ...result, timestamp: 100 }, 1)).toHaveLength(1);
      expect(computeBestWpm([result, { ...result, wpm: 50 }])).toBe(50);
      expect(computeAverageWpm([result, { ...result, wpm: 50 }])).toBe(45);
      expect(formatTypingClock(65)).toBe('01:05');
      expect(formatTypingResultsSummary([result])).toContain('40 WPM');
    });
  });

  describe('character and completion helpers', () => {
    it('resolves class names and passage completion', () => {
      expect(typingCharacterClassName(0, '', 'ab')).toContain('tst-char--current');
      expect(typingCharacterClassName(0, 'a', 'ab')).toContain('tst-char--correct');
      expect(typingCharacterClassName(0, 'x', 'ab')).toContain('tst-char--incorrect');
      expect(isTypingPassageComplete('ab', 'ab')).toBe(true);
      expect(isTypingPassageComplete('a', 'ab')).toBe(false);
    });
  });

  describe('resolveTypingSuggestion', () => {
    it('prioritizes accuracy, high WPM, and idle guidance', () => {
      expect(
        resolveTypingSuggestion({
          isActive: false,
          isComplete: true,
          resultCount: 1,
          latestWpm: 30,
          latestAccuracy: 80
        })?.id
      ).toBe('tst-accuracy');

      expect(
        resolveTypingSuggestion({
          isActive: false,
          isComplete: true,
          resultCount: 1,
          latestWpm: 70,
          latestAccuracy: 98
        })?.id
      ).toBe('tst-high-wpm');

      expect(
        resolveTypingSuggestion({
          isActive: false,
          isComplete: false,
          resultCount: 0,
          latestWpm: 0,
          latestAccuracy: 0
        })?.id
      ).toBe('tst-start');
    });
  });
});
