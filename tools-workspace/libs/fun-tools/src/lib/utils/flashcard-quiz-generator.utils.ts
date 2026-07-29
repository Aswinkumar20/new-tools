import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  FQG_ERROR_BACK_EMPTY,
  FQG_ERROR_FRONT_EMPTY,
  FQG_MIN_CARDS_FOR_QUIZ
} from '../constants/flashcard-quiz-generator.constants';
import type {
  Flashcard,
  FlashcardSideValues,
  QuizAnswer,
  QuizStats
} from '../types/flashcard-quiz-generator.types';

/** Matches legacy id generation (including `substr`). */
export function createFlashcardId(
  now: (() => number) = Date.now,
  random: (() => number) = Math.random
): string {
  return now().toString() + random().toString(36).substr(2, 9);
}

export function validateFlashcardSides(values: FlashcardSideValues): string | null {
  if (!values.front.trim()) {
    return FQG_ERROR_FRONT_EMPTY;
  }
  if (!values.back.trim()) {
    return FQG_ERROR_BACK_EMPTY;
  }
  return null;
}

export function createFlashcard(
  values: FlashcardSideValues,
  now: (() => number) = Date.now,
  random: (() => number) = Math.random
): Flashcard {
  return {
    id: createFlashcardId(now, random),
    front: values.front.trim(),
    back: values.back.trim(),
    createdAt: now()
  };
}

export function updateFlashcardInList(
  cards: readonly Flashcard[],
  id: string,
  values: FlashcardSideValues
): Flashcard[] {
  const front = values.front.trim();
  const back = values.back.trim();
  return cards.map((card) => (card.id === id ? { ...card, front, back } : card));
}

export function deleteFlashcardFromList(cards: readonly Flashcard[], id: string): Flashcard[] {
  return cards.filter((card) => card.id !== id);
}

export function computeQuizProgress(answered: number, total: number): number {
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}

export function computeQuizStats(answers: readonly QuizAnswer[]): QuizStats {
  const correct = answers.filter((a) => a.correct).length;
  const total = answers.length;
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
  };
}

export function createQuizAnswer(
  flashcardId: string,
  correct: boolean,
  now: (() => number) = Date.now
): QuizAnswer {
  return { flashcardId, correct, timestamp: now() };
}

export function resolveFlashcardQuizSuggestion(options: {
  cardCount: number;
  quizMode: boolean;
  isQuizComplete: boolean;
  accuracy: number;
  answeredCount: number;
}): FtToolSuggestion | null {
  const { cardCount, quizMode, isQuizComplete, accuracy, answeredCount } = options;

  if (cardCount === 0) {
    return {
      id: 'fqg-lorem',
      title: 'Need placeholder card text?',
      reason:
        'Sketch your deck layout with Lorem Ipsum, then replace with real questions and answers.',
      actionLabel: 'Open Lorem Ipsum Generator',
      path: '/fun-tools/lorem-ipsum-generator'
    };
  }

  if (cardCount > 0 && cardCount < FQG_MIN_CARDS_FOR_QUIZ) {
    return {
      id: 'fqg-need-more',
      title: 'Add one more card to quiz',
      reason: `Quizzes need at least ${FQG_MIN_CARDS_FOR_QUIZ} cards. Draft filler text in Lorem Ipsum, then paste a second Q&A pair here.`,
      actionLabel: 'Open Lorem Ipsum Generator',
      path: '/fun-tools/lorem-ipsum-generator'
    };
  }

  if (isQuizComplete && answeredCount > 0 && accuracy < 70) {
    return {
      id: 'fqg-pomodoro',
      title: 'Review with a focused session?',
      reason:
        'Accuracy is under 70%. A Pomodoro round can structure another pass through the weak cards.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  if (isQuizComplete) {
    return {
      id: 'fqg-quote',
      title: 'Celebrate the round?',
      reason:
        'Grab a motivational quote before the next quiz pass, or keep refining the deck here.',
      actionLabel: 'Open Motivational Quote Generator',
      path: '/fun-tools/motivational-quote-generator'
    };
  }

  if (quizMode) {
    return {
      id: 'fqg-typing',
      title: 'Want a typing drill next?',
      reason:
        'After flipping cards, Typing Speed Test helps reinforce recall under light time pressure.',
      actionLabel: 'Open Typing Speed Test',
      path: '/fun-tools/typing-speed-test'
    };
  }

  if (cardCount >= 5) {
    return {
      id: 'fqg-markdown',
      title: 'Keep longer notes in Markdown?',
      reason:
        'Larger decks often pair with study notes. Preview Markdown drafts beside this deck.',
      actionLabel: 'Open Markdown Previewer',
      path: '/file-viewers/markdown-previewer'
    };
  }

  return {
    id: 'fqg-pomodoro-ready',
    title: 'Ready to study in intervals?',
    reason:
      'Your deck can start a quiz. Pomodoro Timer helps pace review sessions between rounds.',
    actionLabel: 'Open Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer'
  };
}
