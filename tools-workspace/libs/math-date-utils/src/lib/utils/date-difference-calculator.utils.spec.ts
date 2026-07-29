import {
  buildDurationSegments,
  calculateDateDifference,
  computeBusinessDays,
  formatCountdown,
  formatDateDiffResultText,
  formatExactSpan,
  mapDateDiffCalculationError,
  parseDateInput,
  prependDateDiffHistory,
  resolveDateDiffSuggestion
} from './date-difference-calculator.utils';
import type { DateDiffHistory } from '../types/date-difference-calculator.types';

describe('date-difference-calculator.utils', () => {
  describe('calculateDateDifference', () => {
    it('computes a forward span with business days', () => {
      const result = calculateDateDifference({
        startDate: new Date(2024, 0, 1),
        endDate: new Date(2024, 0, 10),
        includeTime: false,
        includeTimeline: true,
        includeMilestones: false,
        countBusinessDays: true,
        includeWeekdayBreakdown: true
      });

      expect(result.summary.isForward).toBe(true);
      expect(result.summary.totalDays).toBe(9);
      expect(result.summary.businessDays).toBeGreaterThan(0);
      expect(result.timeline?.length).toBe(4);
      expect(result.weekdayBreakdown?.weekdays).toBeGreaterThan(0);
    });

    it('orders reversed dates chronologically', () => {
      const result = calculateDateDifference({
        startDate: new Date(2024, 5, 1),
        endDate: new Date(2024, 0, 1),
        includeTime: false,
        includeTimeline: false,
        includeMilestones: false,
        countBusinessDays: false,
        includeWeekdayBreakdown: false
      });

      expect(result.summary.isForward).toBe(false);
      expect(result.summary.totalDays).toBeGreaterThan(0);
    });
  });

  describe('parseDateInput', () => {
    it('parses ISO dates and today', () => {
      const today = parseDateInput('today', '00:00', false, 'Start date');
      expect(Number.isNaN(today.getTime())).toBe(false);
      const dated = parseDateInput('2015-06-15', '14:30', true, 'Start date');
      expect(dated.getFullYear()).toBe(2015);
      expect(dated.getHours()).toBe(14);
    });

    it('rejects empty and invalid values', () => {
      expect(() => parseDateInput('   ', '00:00', false, 'Start date')).toThrow(
        'Start date cannot be empty.'
      );
      expect(() => parseDateInput('bad', '00:00', false, 'End date')).toThrow(
        'End date is not a valid date'
      );
    });
  });

  describe('helpers', () => {
    it('formats spans, countdowns, and copy text', () => {
      expect(formatExactSpan({ years: 1, months: 2, days: 3 })).toBe(
        '1 year, 2 months, 3 days'
      );
      expect(formatCountdown({ months: 1, days: 2, hours: 3 })).toContain('1 month');
      expect(formatCountdown(undefined)).toBe('');

      const result = calculateDateDifference({
        startDate: new Date(2023, 0, 1),
        endDate: new Date(2024, 0, 1),
        includeTime: false,
        includeTimeline: false,
        includeMilestones: false,
        countBusinessDays: true,
        includeWeekdayBreakdown: false
      });
      expect(formatDateDiffResultText(result)).toContain('Total days:');
      expect(computeBusinessDays(new Date(2024, 0, 1), new Date(2024, 0, 5))).toBeGreaterThan(0);
    });

    it('builds duration segments and history', () => {
      expect(buildDurationSegments(undefined, 10)).toEqual([]);
      const segments = buildDurationSegments(
        [{ label: 'A', description: 'a', days: 50 }],
        100
      );
      expect(segments[0].proportion).toBe(50);

      const result = calculateDateDifference({
        startDate: new Date(2023, 0, 1),
        endDate: new Date(2023, 0, 2),
        includeTime: false,
        includeTimeline: false,
        includeMilestones: false,
        countBusinessDays: false,
        includeWeekdayBreakdown: false
      });
      const entry = (startDate: string): DateDiffHistory => ({
        ...result,
        startDate,
        endDate: 'today',
        startTime: '00:00',
        endTime: '00:00',
        includeTime: false,
        includeTimeline: false,
        includeMilestones: false,
        countBusinessDays: false,
        includeWeekdayBreakdown: false
      });
      const next = prependDateDiffHistory([entry('2023-01-01')], entry('2023-02-01'), 2);
      expect(next[0].startDate).toBe('2023-02-01');
      expect(mapDateDiffCalculationError(new Error('x'))).toBe('x');
    });
  });

  describe('resolveDateDiffSuggestion', () => {
    it('prioritizes validation and reversed spans', () => {
      expect(
        resolveDateDiffSuggestion({
          hasResult: false,
          hasError: true,
          totalDays: 0,
          isForward: true,
          includeTime: false,
          countBusinessDays: false
        })?.id
      ).toBe('ddc-invalid-date');

      expect(
        resolveDateDiffSuggestion({
          hasResult: true,
          hasError: false,
          totalDays: 10,
          isForward: false,
          includeTime: false,
          countBusinessDays: false
        })?.id
      ).toBe('ddc-reversed');
    });

    it('suggests age calculator for long spans', () => {
      expect(
        resolveDateDiffSuggestion({
          hasResult: true,
          hasError: false,
          totalDays: 400,
          isForward: true,
          includeTime: false,
          countBusinessDays: false
        })?.id
      ).toBe('ddc-long-span');
    });
  });
});
