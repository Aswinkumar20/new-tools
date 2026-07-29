import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  MOTIVATIONAL_QUOTES,
  MQG_FOCUS_SESSION_THRESHOLD,
  MQG_HISTORY_LIMIT
} from '../constants/motivational-quote-generator.constants';
import type {
  MotivationalQuote,
  QuoteGeneratorStats,
  QuoteHistoryEntry
} from '../types/motivational-quote-generator.types';

export function pickRandomQuote(
  quotes: ReadonlyArray<MotivationalQuote> = MOTIVATIONAL_QUOTES,
  random: (() => number) = Math.random
): MotivationalQuote {
  const randomIndex = Math.floor(random() * quotes.length);
  return quotes[randomIndex];
}

export function prependQuoteHistory(
  history: readonly QuoteHistoryEntry[],
  quote: MotivationalQuote,
  now: (() => number) = Date.now,
  limit = MQG_HISTORY_LIMIT
): QuoteHistoryEntry[] {
  return [{ quote, timestamp: now() }, ...history].slice(0, limit);
}

export function toggleFavoriteId(favorites: readonly string[], quoteId: string): string[] {
  return favorites.includes(quoteId)
    ? favorites.filter((id) => id !== quoteId)
    : [...favorites, quoteId];
}

export function formatQuoteCopyText(quote: MotivationalQuote | null): string {
  return quote ? `"${quote.text}" - ${quote.author}` : '';
}

export function formatQuoteTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function computeQuoteStats(
  history: readonly QuoteHistoryEntry[],
  favorites: readonly string[]
): QuoteGeneratorStats {
  const uniqueQuotes = new Set(history.map((h) => h.quote.id)).size;
  return {
    totalGenerated: history.length,
    uniqueQuotes,
    favorites: favorites.length
  };
}

export function resolveMotivationalQuoteSuggestion(options: {
  hasQuote: boolean;
  historyCount: number;
  favoriteCount: number;
  isCurrentFavorite: boolean;
}): FtToolSuggestion | null {
  const { hasQuote, historyCount, favoriteCount, isCurrentFavorite } = options;

  if (!hasQuote) {
    return {
      id: 'mqg-start',
      title: 'Need a spark to begin?',
      reason:
        'Generate a quote here, then start a Pomodoro interval while the inspiration is fresh.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  if (isCurrentFavorite || favoriteCount > 0) {
    return {
      id: 'mqg-flashcards',
      title: 'Study your favorite quotes?',
      reason:
        'Copy starred quotes into Flashcard & Quiz Generator as front/back cards for recall practice.',
      actionLabel: 'Open Flashcard & Quiz Generator',
      path: '/fun-tools/flashcard-quiz-generator'
    };
  }

  if (historyCount >= MQG_FOCUS_SESSION_THRESHOLD) {
    return {
      id: 'mqg-pomodoro',
      title: 'Ready to act on inspiration?',
      reason:
        'You have browsed several quotes. A Pomodoro session helps turn motivation into focused work.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  return {
    id: 'mqg-typing',
    title: 'Type this quote for practice?',
    reason:
      'Copy the current quote into Typing Speed Test to reinforce the line while warming up your fingers.',
    actionLabel: 'Open Typing Speed Test',
    path: '/fun-tools/typing-speed-test'
  };
}
