import type { FtToolSuggestion } from '../shared/ft-tool-suggestion.model';
import {
  STOPWATCH_LAP_FOCUS_THRESHOLD,
  STOPWATCH_LONG_SESSION_MS
} from '../constants/stopwatch-timer.constants';
import type { LapTime, StopwatchLapStats } from '../types/stopwatch-timer.types';

export function formatStopwatchTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function formatStopwatchLapTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function computeStopwatchLapStats(laps: readonly LapTime[]): StopwatchLapStats {
  if (laps.length === 0) {
    return { count: 0, fastest: 0, slowest: 0, average: 0 };
  }

  const lapDurations = laps.map((lap) => lap.lapTime);
  const sum = lapDurations.reduce((acc, val) => acc + val, 0);
  return {
    count: laps.length,
    fastest: Math.min(...lapDurations),
    slowest: Math.max(...lapDurations),
    average: sum / lapDurations.length
  };
}

export function createLapEntry(
  elapsedMs: number,
  lastLapMs: number,
  existingLapCount: number,
  now: (() => number) = Date.now
): LapTime {
  return {
    lapNumber: existingLapCount + 1,
    lapTime: elapsedMs - lastLapMs,
    totalTime: elapsedMs,
    timestamp: now()
  };
}

export function formatLapsCopyText(laps: readonly LapTime[]): string {
  return laps
    .map(
      (lap) =>
        `Lap ${lap.lapNumber}: ${formatStopwatchLapTime(lap.lapTime)} (total ${formatStopwatchTime(lap.totalTime)})`
    )
    .join('\n');
}

export function computeStartTimestamp(nowMs: number, elapsedMs: number): number {
  return nowMs - elapsedMs;
}

export function resolveStopwatchSuggestion(options: {
  isRunning: boolean;
  elapsedMs: number;
  lapCount: number;
}): FtToolSuggestion | null {
  const { isRunning, elapsedMs, lapCount } = options;

  if (!isRunning && elapsedMs === 0 && lapCount === 0) {
    return {
      id: 'st-pomodoro',
      title: 'Need structured focus intervals?',
      reason:
        'Stopwatch is open-ended. Pomodoro Timer adds work/break cadence when you want guided sessions.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  if (lapCount >= STOPWATCH_LAP_FOCUS_THRESHOLD) {
    return {
      id: 'st-typing',
      title: 'Timing practice drills?',
      reason:
        'With several laps recorded, Typing Speed Test can score timed drills instead of manual splits.',
      actionLabel: 'Open Typing Speed Test',
      path: '/fun-tools/typing-speed-test'
    };
  }

  if (elapsedMs >= STOPWATCH_LONG_SESSION_MS) {
    return {
      id: 'st-long-pomodoro',
      title: 'Long session — try Pomodoro?',
      reason:
        'You have been timing for 25+ minutes. Pomodoro Timer helps insert breaks automatically.',
      actionLabel: 'Open Pomodoro Timer',
      path: '/fun-tools/pomodoro-timer'
    };
  }

  if (isRunning) {
    return {
      id: 'st-quote',
      title: 'Stay motivated mid-run?',
      reason:
        'Grab a line from Motivational Quote Generator during a pause without losing your elapsed time.',
      actionLabel: 'Open Motivational Quote Generator',
      path: '/fun-tools/motivational-quote-generator'
    };
  }

  return {
    id: 'st-pomodoro-idle',
    title: 'Switch to interval training?',
    reason:
      'Paused with time on the clock. Pomodoro Timer is better when the next block should auto-end.',
    actionLabel: 'Open Pomodoro Timer',
    path: '/fun-tools/pomodoro-timer'
  };
}
