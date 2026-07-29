import {
  computeStartTimestamp,
  computeStopwatchLapStats,
  createLapEntry,
  formatLapsCopyText,
  formatStopwatchLapTime,
  formatStopwatchTime,
  resolveStopwatchSuggestion
} from './stopwatch-timer.utils';

describe('stopwatch-timer.utils', () => {
  describe('formatting', () => {
    it('formats under and over one hour', () => {
      expect(formatStopwatchTime(65050)).toBe('01:05.05');
      expect(formatStopwatchTime(3661500)).toBe('01:01:01.50');
      expect(formatStopwatchLapTime(65050)).toBe('01:05.05');
    });

    it('formats lap copy text', () => {
      expect(
        formatLapsCopyText([
          { lapNumber: 1, lapTime: 1000, totalTime: 1000, timestamp: 1 }
        ])
      ).toBe('Lap 1: 00:01.00 (total 00:01.00)');
    });
  });

  describe('laps and stats', () => {
    it('creates lap entries and computes stats', () => {
      const lap = createLapEntry(5000, 2000, 1, () => 99);
      expect(lap).toEqual({
        lapNumber: 2,
        lapTime: 3000,
        totalTime: 5000,
        timestamp: 99
      });
      expect(computeStartTimestamp(1000, 250)).toBe(750);
      expect(
        computeStopwatchLapStats([
          { lapNumber: 1, lapTime: 100, totalTime: 100, timestamp: 1 },
          { lapNumber: 2, lapTime: 300, totalTime: 400, timestamp: 2 }
        ])
      ).toEqual({ count: 2, fastest: 100, slowest: 300, average: 200 });
    });
  });

  describe('resolveStopwatchSuggestion', () => {
    it('suggests pomodoro when idle and typing after several laps', () => {
      expect(
        resolveStopwatchSuggestion({
          isRunning: false,
          elapsedMs: 0,
          lapCount: 0
        })?.id
      ).toBe('st-pomodoro');
      expect(
        resolveStopwatchSuggestion({
          isRunning: true,
          elapsedMs: 1000,
          lapCount: 3
        })?.id
      ).toBe('st-typing');
    });
  });
});
