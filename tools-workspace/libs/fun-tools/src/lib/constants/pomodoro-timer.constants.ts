import type { FtRelatedToolLink } from '../shared/ft-tool-suggestion.model';
import type { PomodoroSettings } from '../types/pomodoro-timer.types';

export const POMODORO_DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4
};

export const POMODORO_CIRCLE_RADIUS = 45;
export const POMODORO_TICK_MS = 1000;

export const POMODORO_BEEP_FREQUENCY_HZ = 800;
export const POMODORO_BEEP_DURATION_S = 0.5;
export const POMODORO_BEEP_GAIN = 0.3;

export const POMODORO_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  {
    label: 'Stopwatch & Timer',
    path: '/fun-tools/stopwatch-timer',
    description: 'Need open-ended timing without Pomodoro intervals?'
  },
  {
    label: 'Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator',
    description: 'Start a focus block with a quick dose of inspiration'
  },
  {
    label: 'Flashcard & Quiz Generator',
    path: '/fun-tools/flashcard-quiz-generator',
    description: 'Use work intervals to drill a study deck'
  },
  {
    label: 'Typing Speed Test',
    path: '/fun-tools/typing-speed-test',
    description: 'Warm up or fill a short break with a typing drill'
  },
  {
    label: 'Coin Toss & Dice Roller',
    path: '/fun-tools/coin-toss-dice-roller',
    description: 'Decide what to tackle next during a break'
  }
];
