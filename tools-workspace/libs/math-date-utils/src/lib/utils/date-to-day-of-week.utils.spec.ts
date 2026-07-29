import {
  addDays,
  approximateMoonPhase,
  buildDayDetails,
  buildInsights,
  buildRelativeLabel,
  buildUpcomingWeekdays,
  formatDateInput,
  formatDayDetailsText,
  getNextWeekday,
  isLeapYear,
  prependDayLookupHistory,
  resolveDayOfWeekSuggestion,
  resolvePresetDate
} from './date-to-day-of-week.utils';
import type { DayLookup } from '../types/date-to-day-of-week.types';

describe('date-to-day-of-week.utils', () => {
  describe('buildDayDetails', () => {
    it('computes weekday insights for a known date', () => {
      const details = buildDayDetails('2024-01-01', 'UTC', 'en-US');
      expect(details.isoDate).toBe('2024-01-01');
      expect(details.dayName).toBeTruthy();
      expect(details.weekNumber).toBeGreaterThan(0);
      expect(details.dayOfYear).toBeGreaterThan(0);
      expect(details.totalDaysInYear).toBe(366);
      expect(details.seasonLabel).toContain('hemisphere');
      expect(details.lunarApproximation).toContain('moon phase');
    });
  });

  describe('presets and upcoming', () => {
    it('resolves presets and upcoming weekdays', () => {
      const base = new Date(2024, 5, 15);
      expect(resolvePresetDate('today', base)).toBe(formatDateInput(base));
      expect(resolvePresetDate('tomorrow', base)).toBe(formatDateInput(addDays(base, 1)));
      expect(resolvePresetDate('yesterday', base)).toBe(formatDateInput(addDays(base, -1)));

      const upcoming = buildUpcomingWeekdays('2024-06-15', 'UTC');
      expect(upcoming).toHaveLength(3);
      expect(upcoming[0].date).toBe('2024-06-16');
    });

    it('jumps to the next weekday', () => {
      const monday = getNextWeekday(new Date(2024, 5, 15), 1);
      expect(monday.getDay()).toBe(1);
    });
  });

  describe('labels and history', () => {
    it('builds relative labels and insights', () => {
      expect(buildRelativeLabel(0)).toBe('Today');
      expect(buildRelativeLabel(1)).toBe('Tomorrow');
      expect(buildRelativeLabel(-1)).toBe('Yesterday');
      expect(buildRelativeLabel(5)).toBe('In 5 days');
      expect(buildRelativeLabel(-3)).toBe('3 days ago');

      const details = buildDayDetails('2024-06-15', 'UTC', 'en-US');
      const insights = buildInsights(details);
      expect(insights.length).toBeGreaterThan(3);
      expect(formatDayDetailsText(details, insights)).toContain(details.dayName);
    });

    it('prepends history and checks leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2023)).toBe(false);
      expect(approximateMoonPhase(new Date('2024-01-01T00:00:00Z'))).toContain('moon phase');

      const entry = (isoDate: string): DayLookup => ({
        isoDate,
        dayName: 'Monday',
        timezone: 'UTC',
        locale: 'en-US',
        relativeLabel: 'Today',
        computedAt: Date.now()
      });
      const next = prependDayLookupHistory([entry('2024-01-01')], entry('2024-01-02'), 2);
      expect(next[0].isoDate).toBe('2024-01-02');
    });
  });

  describe('resolveDayOfWeekSuggestion', () => {
    it('prioritizes today and weekend contexts', () => {
      expect(
        resolveDayOfWeekSuggestion({
          hasResult: true,
          hasError: false,
          isWeekend: false,
          isToday: true,
          daysFromToday: 0,
          isoWeekday: 3
        })?.id
      ).toBe('dt-today');

      expect(
        resolveDayOfWeekSuggestion({
          hasResult: true,
          hasError: false,
          isWeekend: true,
          isToday: false,
          daysFromToday: 2,
          isoWeekday: 6
        })?.id
      ).toBe('dt-weekend');
    });

    it('suggests age tools for long-range dates', () => {
      expect(
        resolveDayOfWeekSuggestion({
          hasResult: true,
          hasError: false,
          isWeekend: false,
          isToday: false,
          daysFromToday: -400,
          isoWeekday: 2
        })?.id
      ).toBe('dt-long-range');
    });
  });
});
