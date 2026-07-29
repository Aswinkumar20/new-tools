import {
  computePomodoroProgress,
  formatPomodoroClock,
  getPomodoroCircleCircumference,
  getPomodoroCircleDashOffset,
  getPomodoroTotalSeconds,
  pomodoroCompletionToastMessage,
  resolveNextPomodoroMode,
  resolvePomodoroSuggestion,
  sessionsUntilLongBreak
} from './pomodoro-timer.utils';
import { POMODORO_DEFAULT_SETTINGS } from '../constants/pomodoro-timer.constants';

describe('pomodoro-timer.utils', () => {
  describe('durations and mode transitions', () => {
    it('converts settings to seconds by mode', () => {
      expect(getPomodoroTotalSeconds('work', POMODORO_DEFAULT_SETTINGS)).toBe(25 * 60);
      expect(getPomodoroTotalSeconds('break', POMODORO_DEFAULT_SETTINGS)).toBe(5 * 60);
      expect(getPomodoroTotalSeconds('longBreak', POMODORO_DEFAULT_SETTINGS)).toBe(15 * 60);
    });

    it('chooses short vs long break after work', () => {
      expect(resolveNextPomodoroMode('work', 1, 4)).toBe('break');
      expect(resolveNextPomodoroMode('work', 4, 4)).toBe('longBreak');
      expect(resolveNextPomodoroMode('break', 4, 4)).toBe('work');
      expect(resolveNextPomodoroMode('longBreak', 4, 4)).toBe('work');
    });

    it('reports sessions until long break', () => {
      expect(sessionsUntilLongBreak(0, 4)).toBe(4);
      expect(sessionsUntilLongBreak(3, 4)).toBe(1);
      expect(sessionsUntilLongBreak(4, 4)).toBe(4);
    });
  });

  describe('display helpers', () => {
    it('formats clock and circle progress', () => {
      expect(formatPomodoroClock(65)).toBe('01:05');
      expect(computePomodoroProgress(100, 25)).toBe(75);
      expect(getPomodoroCircleCircumference(45)).toBeCloseTo(2 * Math.PI * 45);
      expect(getPomodoroCircleDashOffset(0, 45)).toBeCloseTo(2 * Math.PI * 45);
      expect(getPomodoroCircleDashOffset(100, 45)).toBeCloseTo(0);
    });

    it('builds completion toast copy', () => {
      expect(pomodoroCompletionToastMessage('work')).toContain('Work session');
      expect(pomodoroCompletionToastMessage('break')).toContain('Break complete');
    });
  });

  describe('resolvePomodoroSuggestion', () => {
    it('suggests quote when idle and flashcards while working', () => {
      expect(
        resolvePomodoroSuggestion({
          isRunning: false,
          mode: 'work',
          completedPomodoros: 0
        })?.id
      ).toBe('pt-quote');
      expect(
        resolvePomodoroSuggestion({
          isRunning: true,
          mode: 'work',
          completedPomodoros: 0
        })?.id
      ).toBe('pt-flashcards');
      expect(
        resolvePomodoroSuggestion({
          isRunning: false,
          mode: 'break',
          completedPomodoros: 1
        })?.id
      ).toBe('pt-typing');
    });
  });
});
