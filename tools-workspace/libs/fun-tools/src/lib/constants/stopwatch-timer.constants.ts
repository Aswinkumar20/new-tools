import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';

/** Display refresh interval (ms) for smooth centisecond updates. */
export const STOPWATCH_TICK_MS = 10;

/** Suggest Pomodoro after this many recorded laps. */
export const STOPWATCH_LAP_FOCUS_THRESHOLD = 3;

/** Suggest structured timing after this much elapsed time (ms). */
export const STOPWATCH_LONG_SESSION_MS = 25 * 60 * 1000;

export const STOPWATCH_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer',
    description: 'Prefer work/break intervals instead of open-ended timing?'
  },
  {
    label: 'Typing Speed Test',
    path: '/fun-tools/typing-speed-test',
    description: 'Time typing drills with WPM scoring'
  },
  {
    label: 'Coin Toss & Dice Roller',
    path: '/fun-tools/coin-toss-dice-roller',
    description: 'Decide the next activity during a pause'
  },
  {
    label: 'Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator',
    description: 'Reset focus with a quick quote between laps'
  },
  {
    label: 'Flashcard & Quiz Generator',
    path: '/fun-tools/flashcard-quiz-generator',
    description: 'Study cards while you track practice time'
  }
];
