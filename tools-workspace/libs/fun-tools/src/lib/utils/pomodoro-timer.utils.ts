import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  POMODORO_BEEP_DURATION_S,
  POMODORO_BEEP_FREQUENCY_HZ,
  POMODORO_BEEP_GAIN,
  POMODORO_CIRCLE_RADIUS
} from '../constants/pomodoro-timer.constants';
import type {
  PomodoroSettings,
  PomodoroTimerMode
} from '../types/pomodoro-timer.types';

export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

export function getPomodoroTotalSeconds(
  mode: PomodoroTimerMode,
  settings: PomodoroSettings
): number {
  if (mode === 'work') {
    return minutesToSeconds(settings.workMinutes);
  }
  if (mode === 'longBreak') {
    return minutesToSeconds(settings.longBreakMinutes);
  }
  return minutesToSeconds(settings.breakMinutes);
}

export function resolveNextPomodoroMode(
  currentMode: PomodoroTimerMode,
  sessionAfterWorkComplete: number,
  longBreakInterval: number
): PomodoroTimerMode {
  if (currentMode === 'work') {
    return sessionAfterWorkComplete % longBreakInterval === 0 ? 'longBreak' : 'break';
  }
  return 'work';
}

export function sessionsUntilLongBreak(
  currentSession: number,
  longBreakInterval: number
): number {
  return longBreakInterval - (currentSession % longBreakInterval);
}

export function computePomodoroProgress(initialSeconds: number, remainingSeconds: number): number {
  return initialSeconds > 0 ? ((initialSeconds - remainingSeconds) / initialSeconds) * 100 : 0;
}

export function formatPomodoroClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getPomodoroCircleCircumference(radius = POMODORO_CIRCLE_RADIUS): number {
  return 2 * Math.PI * radius;
}

export function getPomodoroCircleDashOffset(progressPercent: number, radius = POMODORO_CIRCLE_RADIUS): number {
  const circumference = getPomodoroCircleCircumference(radius);
  return circumference * (1 - progressPercent / 100);
}

export function pomodoroModeLabel(mode: PomodoroTimerMode): string {
  if (mode === 'work') {
    return 'Work';
  }
  if (mode === 'longBreak') {
    return 'Long Break';
  }
  return 'Break';
}

export function pomodoroCompletionToastMessage(completedMode: PomodoroTimerMode): string {
  if (completedMode === 'work') {
    return 'Work session complete — time for a break';
  }
  if (completedMode === 'longBreak') {
    return 'Long break complete — ready to focus';
  }
  return 'Break complete — ready to focus';
}

/** Soft beep via Web Audio API when supported; no-ops on failure. */
export function playPomodoroNotificationBeep(
  audioContextCtor: typeof AudioContext | undefined = typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined
): void {
  if (!audioContextCtor) {
    return;
  }

  try {
    const audioContext = new audioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = POMODORO_BEEP_FREQUENCY_HZ;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(POMODORO_BEEP_GAIN, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + POMODORO_BEEP_DURATION_S);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + POMODORO_BEEP_DURATION_S);
  } catch {
    // Audio not supported or failed — silent by design
  }
}

export function resolvePomodoroSuggestion(options: {
  isRunning: boolean;
  mode: PomodoroTimerMode;
  completedPomodoros: number;
}): FtToolSuggestion | null {
  const { isRunning, mode, completedPomodoros } = options;

  if (!isRunning && completedPomodoros === 0 && mode === 'work') {
    return {
      id: 'pt-quote',
      title: 'Kick off with a quote?',
      reason:
        'Grab a line from Motivational Quote Generator before you start the first focus block.',
      actionLabel: 'Open Motivational Quote Generator',
      path: '/fun-tools/motivational-quote-generator'
    };
  }

  if (isRunning && mode === 'work') {
    return {
      id: 'pt-flashcards',
      title: 'Studying this session?',
      reason:
        'Pair focus time with Flashcard & Quiz Generator to drill cards during the work interval.',
      actionLabel: 'Open Flashcard & Quiz Generator',
      path: '/fun-tools/flashcard-quiz-generator'
    };
  }

  if (mode === 'break' || mode === 'longBreak') {
    return {
      id: 'pt-typing',
      title: 'Light break activity?',
      reason:
        'A short Typing Speed Test keeps your fingers warm without turning the break into another deep-work block.',
      actionLabel: 'Open Typing Speed Test',
      path: '/fun-tools/typing-speed-test'
    };
  }

  if (completedPomodoros >= 2) {
    return {
      id: 'pt-stopwatch',
      title: 'Need flexible timing next?',
      reason:
        'After a few Pomodoros, Stopwatch & Timer is handy for open-ended wrap-up work.',
      actionLabel: 'Open Stopwatch & Timer',
      path: '/fun-tools/stopwatch-timer'
    };
  }

  return {
    id: 'pt-quote-idle',
    title: 'Reset with inspiration?',
    reason:
      'Between sessions, Motivational Quote Generator is a quick mental reset before the next Start.',
    actionLabel: 'Open Motivational Quote Generator',
    path: '/fun-tools/motivational-quote-generator'
  };
}
