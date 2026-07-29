import {
  computeQuoteStats,
  formatQuoteCopyText,
  pickRandomQuote,
  prependQuoteHistory,
  resolveMotivationalQuoteSuggestion,
  toggleFavoriteId
} from './motivational-quote-generator.utils';
import type { MotivationalQuote } from '../types/motivational-quote-generator.types';

const sample: MotivationalQuote = {
  id: '1',
  text: 'Hello',
  author: 'Tester'
};

describe('motivational-quote-generator.utils', () => {
  describe('pickRandomQuote / history / favorites', () => {
    it('picks by random index and prepends capped history', () => {
      const quotes = [sample, { ...sample, id: '2', text: 'Two' }];
      expect(pickRandomQuote(quotes, () => 0).id).toBe('1');
      expect(pickRandomQuote(quotes, () => 0.99).id).toBe('2');

      const history = prependQuoteHistory([], sample, () => 10, 2);
      expect(history).toEqual([{ quote: sample, timestamp: 10 }]);
      const capped = prependQuoteHistory(history, { ...sample, id: '2' }, () => 11, 2);
      expect(capped.length).toBe(2);
      expect(capped[0].quote.id).toBe('2');
    });

    it('toggles favorites and formats copy text', () => {
      expect(toggleFavoriteId([], '1')).toEqual(['1']);
      expect(toggleFavoriteId(['1'], '1')).toEqual([]);
      expect(formatQuoteCopyText(sample)).toBe('"Hello" - Tester');
      expect(formatQuoteCopyText(null)).toBe('');
    });

    it('computes stats', () => {
      expect(
        computeQuoteStats(
          [
            { quote: sample, timestamp: 1 },
            { quote: sample, timestamp: 2 }
          ],
          ['1', '2']
        )
      ).toEqual({ totalGenerated: 2, uniqueQuotes: 1, favorites: 2 });
    });
  });

  describe('resolveMotivationalQuoteSuggestion', () => {
    it('suggests typing by default and flashcards when favorited', () => {
      expect(
        resolveMotivationalQuoteSuggestion({
          hasQuote: true,
          historyCount: 1,
          favoriteCount: 0,
          isCurrentFavorite: false
        })?.id
      ).toBe('mqg-typing');
      expect(
        resolveMotivationalQuoteSuggestion({
          hasQuote: true,
          historyCount: 1,
          favoriteCount: 1,
          isCurrentFavorite: true
        })?.id
      ).toBe('mqg-flashcards');
      expect(
        resolveMotivationalQuoteSuggestion({
          hasQuote: true,
          historyCount: 5,
          favoriteCount: 0,
          isCurrentFavorite: false
        })?.id
      ).toBe('mqg-pomodoro');
    });
  });
});
