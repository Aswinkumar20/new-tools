import {
  absoluteTimezoneDiffHours,
  buildTimezoneConversion,
  formatConversionOutputText,
  formatLocalDateTimeInput,
  formatTimezoneDifference,
  formatTimezoneOffsetLabel,
  formatTimeInTimezone,
  resolveTimezoneLabel,
  resolveTimezoneSuggestion,
  swapTimezonePair
} from './timezone-converter.utils';
import type { TimezoneOption } from '../types/timezone-converter.types';

const catalog: ReadonlyArray<TimezoneOption> = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+0' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' }
];

describe('timezone-converter.utils', () => {
  describe('formatLocalDateTimeInput', () => {
    it('returns a datetime-local length string', () => {
      const value = formatLocalDateTimeInput(new Date('2024-06-15T12:30:00Z'));
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });

  describe('formatting helpers', () => {
    it('formats time, offset, difference, and labels', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(formatTimeInTimezone(date, 'UTC')).toContain('2024');
      expect(formatTimezoneOffsetLabel(date, 'UTC')).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
      expect(formatTimezoneDifference(date, 'UTC', 'UTC')).toBe('+0 minutes');
      expect(resolveTimezoneLabel('Asia/Tokyo', catalog)).toBe('Tokyo (JST)');
      expect(resolveTimezoneLabel('Unknown/Zone', catalog)).toBe('Unknown/Zone');
      expect(swapTimezonePair('UTC', 'Asia/Tokyo')).toEqual({
        sourceTimezone: 'Asia/Tokyo',
        targetTimezone: 'UTC'
      });
    });
  });

  describe('buildTimezoneConversion', () => {
    it('returns null for incomplete input and builds output when valid', () => {
      expect(
        buildTimezoneConversion(
          { dateTime: '', sourceTimezone: 'UTC', targetTimezone: 'UTC' },
          catalog
        )
      ).toBeNull();

      const result = buildTimezoneConversion(
        {
          dateTime: '2024-01-15T12:00',
          sourceTimezone: 'UTC',
          targetTimezone: 'Asia/Tokyo'
        },
        catalog
      );
      expect(result).not.toBeNull();
      expect(result?.source.timezone).toContain('UTC');
      expect(result?.target.timezone).toContain('Tokyo');
      expect(formatConversionOutputText(result!)).toContain('Difference:');
      expect(
        absoluteTimezoneDiffHours(new Date('2024-01-15T12:00:00Z'), 'UTC', 'Asia/Tokyo')
      ).toBeGreaterThan(0);
    });
  });

  describe('resolveTimezoneSuggestion', () => {
    it('flags matching zones and large gaps', () => {
      expect(
        resolveTimezoneSuggestion({
          sourceTimezone: 'UTC',
          targetTimezone: 'UTC',
          hasConversion: true,
          absoluteDiffHours: 0
        })?.id
      ).toBe('tzc-same-zone');

      expect(
        resolveTimezoneSuggestion({
          sourceTimezone: 'UTC',
          targetTimezone: 'Asia/Tokyo',
          hasConversion: true,
          absoluteDiffHours: 9
        })?.id
      ).toBe('tzc-large-diff');

      expect(
        resolveTimezoneSuggestion({
          sourceTimezone: 'UTC',
          targetTimezone: 'America/New_York',
          hasConversion: true,
          absoluteDiffHours: 5
        })?.id
      ).toBe('tzc-pomodoro');
    });
  });
});
