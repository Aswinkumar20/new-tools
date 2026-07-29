import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  TYPING_HIGH_WPM,
  TYPING_LOW_ACCURACY_PERCENT,
  TYPING_RESULTS_LIMIT
} from '../constants/typing-speed-test.constants';
import type {
  TypingCharState,
  TypingLiveStats,
  TypingTestResult
} from '../types/typing-speed-test.types';

/**
 * Live WPM / accuracy for the current attempt.
 * Preserves existing WPM formula: (words / minutes) * 60 where minutes = seconds / 60.
 */
export function computeTypingLiveStats(
  typedText: string,
  sampleText: string,
  elapsedSeconds: number
): TypingLiveStats {
  if (!typedText || !sampleText || elapsedSeconds === 0) {
    return { wpm: 0, accuracy: 0, characters: 0, correct: 0, incorrect: 0 };
  }

  const characters = typedText.length;
  let correct = 0;
  let incorrect = 0;

  for (let i = 0; i < characters; i++) {
    if (i < sampleText.length && typedText[i] === sampleText[i]) {
      correct++;
    } else {
      incorrect++;
    }
  }

  const words = typedText.trim().split(/\s+/).filter((word) => word.length > 0).length;
  const minutes = elapsedSeconds / 60;
  const wpm = minutes > 0 ? Math.round((words / minutes) * 60) : 0;
  const accuracy = characters > 0 ? Math.round((correct / characters) * 100) : 0;

  return { wpm, accuracy, characters, correct, incorrect };
}

export function createTypingTestResult(
  stats: TypingLiveStats,
  elapsedSeconds: number,
  now: (() => number) = Date.now
): TypingTestResult {
  return {
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    time: elapsedSeconds,
    characters: stats.characters,
    correct: stats.correct,
    incorrect: stats.incorrect,
    timestamp: now()
  };
}

export function prependTypingResult(
  results: readonly TypingTestResult[],
  result: TypingTestResult,
  limit: number = TYPING_RESULTS_LIMIT
): TypingTestResult[] {
  return [result, ...results].slice(0, limit);
}

export function computeBestWpm(results: readonly TypingTestResult[]): number {
  return results.length > 0 ? Math.max(...results.map((result) => result.wpm)) : 0;
}

export function computeAverageWpm(results: readonly TypingTestResult[]): number {
  if (results.length === 0) {
    return 0;
  }
  return Math.round(results.reduce((sum, result) => sum + result.wpm, 0) / results.length);
}

export function formatTypingClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTypingResultsSummary(results: readonly TypingTestResult[]): string {
  return results
    .map((result) => `${result.wpm} WPM · ${result.accuracy}% · ${formatTypingClock(result.time)}`)
    .join('\n');
}

export function resolveTypingCharState(
  index: number,
  typedText: string,
  sampleText: string
): TypingCharState {
  if (index === typedText.length) {
    return 'current';
  }
  if (index < typedText.length) {
    if (index >= sampleText.length || typedText[index] !== sampleText[index]) {
      return 'incorrect';
    }
    return 'correct';
  }
  return 'pending';
}

export function typingCharacterClassName(
  index: number,
  typedText: string,
  sampleText: string
): string {
  const state = resolveTypingCharState(index, typedText, sampleText);
  const classes = ['tst-char'];
  if (state === 'current') {
    classes.push('tst-char--current');
  } else if (state === 'correct') {
    classes.push('tst-char--correct');
  } else if (state === 'incorrect') {
    classes.push('tst-char--incorrect');
  }
  return classes.join(' ');
}

export function isTypingPassageComplete(typedText: string, sampleText: string): boolean {
  return typedText.length >= sampleText.length && sampleText.length > 0;
}

export function resolveTypingSuggestion(options: {
  isActive: boolean;
  isComplete: boolean;
  resultCount: number;
  latestWpm: number;
  latestAccuracy: number;
}): FtToolSuggestion | null {
  const { isActive, isComplete, resultCount, latestWpm, latestAccuracy } = options;

  if (isComplete && latestAccuracy > 0 && latestAccuracy < TYPING_LOW_ACCURACY_PERCENT) {
    return {
      id: 'tst-accuracy',
      title: 'Accuracy under 90%',
      reason:
        'Speed is ahead of precision. Generate fresh practice text with Lorem Ipsum, then retry slower.',
      actionLabel: 'Open Lorem Ipsum Generator',
      path: '/fun-tools/lorem-ipsum-generator'
    };
  }

  if (isComplete && latestWpm >= TYPING_HIGH_WPM) {
    return {
      id: 'tst-high-wpm',
      title: 'Strong speed result',
      reason:
        'You cleared 60+ WPM. Capture the win with Motivational Quote Generator, then run another pass.',
      actionLabel: 'Open Motivational Quote Generator',
      path: '/fun-tools/motivational-quote-generator'
    };
  }

  if (isComplete) {
    return {
      id: 'tst-pomodoro',
      title: 'Turn this into a practice block?',
      reason:
        'Pomodoro Timer helps schedule short typing drills with breaks so you do not burn out.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  if (isActive) {
    return {
      id: 'tst-stopwatch',
      title: 'Prefer open-ended timing?',
      reason:
        'This test ends when the passage is finished. Stopwatch Timer is better for free-form drills.',
      actionLabel: 'Open Stopwatch Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  if (resultCount > 0) {
    return {
      id: 'tst-history',
      title: 'Compare attempts over time',
      reason:
        'You already have saved scores. Use Stopwatch Timer for timed warm-ups before the next run.',
      actionLabel: 'Open Stopwatch Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  return {
    id: 'tst-start',
    title: 'Ready when you are',
    reason:
      'Pick a sample text and start typing — the timer begins on your first keystroke.',
    actionLabel: 'Open Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer'
  };
}
