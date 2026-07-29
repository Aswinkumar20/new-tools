import {
  buildTimelineSegments,
  calculateAge,
  formatAgeResultText,
  formatExactAge,
  mapAgeCalculationError,
  parseDateString,
  prependAgeHistory,
  resolveAgeSuggestion
} from './age-calculator.utils';
import type { AgeHistory } from '../types/age-calculator.types';

describe('age-calculator.utils', () => {
  describe('calculateAge', () => {
    it('computes exact age between two dates', () => {
      const result = calculateAge({
        birthDate: new Date(2000, 0, 1),
        comparisonDate: new Date(2020, 0, 1),
        includeTime: false,
        includeZodiac: true,
        includeMilestones: true,
        showTimeline: true
      });

      expect(result.summary.years).toBe(20);
      expect(result.summary.months).toBe(0);
      expect(result.summary.days).toBe(0);
      expect(result.summary.exactAge).toBe('20 years');
      expect(result.zodiac?.western).toBeTruthy();
      expect(result.timeline?.length).toBe(3);
    });

    it('rejects comparison dates before birth', () => {
      expect(() =>
        calculateAge({
          birthDate: new Date(2000, 0, 1),
          comparisonDate: new Date(1999, 0, 1),
          includeTime: false,
          includeZodiac: false,
          includeMilestones: false,
          showTimeline: false
        })
      ).toThrow('Comparison date cannot be earlier than the birth date.');
    });
  });

  describe('parseDateString', () => {
    it('parses ISO dates and today', () => {
      const today = parseDateString('today', '00:00', false);
      expect(Number.isNaN(today.getTime())).toBe(false);
      const dated = parseDateString('2015-06-15', '14:30', true);
      expect(dated.getFullYear()).toBe(2015);
      expect(dated.getHours()).toBe(14);
      expect(dated.getMinutes()).toBe(30);
    });

    it('rejects empty and invalid values', () => {
      expect(() => parseDateString('   ', '00:00', false)).toThrow('Date cannot be empty.');
      expect(() => parseDateString('not-a-date', '00:00', false)).toThrow('Invalid date format');
    });
  });

  describe('formatExactAge', () => {
    it('formats pluralized segments', () => {
      expect(formatExactAge({ years: 1, months: 1, days: 1 })).toBe('1 year, 1 month, 1 day');
      expect(formatExactAge({ years: 0, months: 0, days: 0 })).toBe('0 days');
    });
  });

  describe('buildTimelineSegments', () => {
    it('returns empty when data is missing', () => {
      expect(buildTimelineSegments(undefined, 10)).toEqual([]);
      expect(buildTimelineSegments([], 0)).toEqual([]);
    });

    it('adds clamped proportions', () => {
      const segments = buildTimelineSegments(
        [
          { label: 'A', description: 'a', days: 50 },
          { label: 'B', description: 'b', days: 0 }
        ],
        100
      );
      expect(segments[0].proportion).toBe(50);
      expect(segments[1].proportion).toBe(0.5);
    });
  });

  describe('formatAgeResultText', () => {
    it('includes zodiac when present', () => {
      const result = calculateAge({
        birthDate: new Date(1990, 4, 12),
        comparisonDate: new Date(2020, 4, 12),
        includeTime: false,
        includeZodiac: true,
        includeMilestones: false,
        showTimeline: false
      });
      const text = formatAgeResultText(result);
      expect(text).toContain('Age:');
      expect(text).toContain('Western:');
      expect(text).toContain('Chinese:');
    });
  });

  describe('prependAgeHistory', () => {
    it('dedupes by birth/comparison/anchor and caps length', () => {
      const base = calculateAge({
        birthDate: new Date(1990, 0, 1),
        comparisonDate: new Date(2000, 0, 1),
        includeTime: false,
        includeZodiac: false,
        includeMilestones: false,
        showTimeline: false
      });

      const entry = (birthDate: string): AgeHistory => ({
        ...base,
        birthDate,
        comparisonDate: 'today',
        birthTime: '00:00',
        comparisonTime: '00:00',
        anchor: 'now',
        includeTime: false,
        includeZodiac: false,
        includeMilestones: false,
        showTimeline: false
      });

      const first = prependAgeHistory([], entry('1990-01-01'), 2);
      const second = prependAgeHistory(first, entry('1991-01-01'), 2);
      const third = prependAgeHistory(second, entry('1990-01-01'), 2);

      expect(third).toHaveLength(2);
      expect(third[0].birthDate).toBe('1990-01-01');
      expect(third[1].birthDate).toBe('1991-01-01');
    });
  });

  describe('resolveAgeSuggestion', () => {
    it('prioritizes date-order errors', () => {
      expect(
        resolveAgeSuggestion({
          hasResult: false,
          hasError: true,
          anchor: 'specific',
          includeZodiac: false,
          totalDays: 0,
          years: 0
        })?.id
      ).toBe('ac-date-order');
    });

    it('suggests zodiac enrichment when enabled', () => {
      expect(
        resolveAgeSuggestion({
          hasResult: true,
          hasError: false,
          anchor: 'now',
          includeZodiac: true,
          totalDays: 5000,
          years: 13
        })?.id
      ).toBe('ac-zodiac');
    });

    it('suggests infant guidance for young ages', () => {
      expect(
        resolveAgeSuggestion({
          hasResult: true,
          hasError: false,
          anchor: 'now',
          includeZodiac: false,
          totalDays: 120,
          years: 0
        })?.id
      ).toBe('ac-infant');
    });
  });

  describe('mapAgeCalculationError', () => {
    it('maps known and unknown errors', () => {
      expect(mapAgeCalculationError(new Error('boom'))).toBe('boom');
      expect(mapAgeCalculationError('x')).toBe('Unable to calculate age.');
    });
  });
});
