import { ICS_SAMPLE_CALENDAR } from '../constants/ics-viewer-sample.data';
import {
  expandEventsForRange,
  parseIcsText,
  parseIcsWithComponents,
  sanitizeIcsUrl
} from './ics-viewer-parse.utils';

describe('ics-viewer-parse.utils', () => {
  it('parses the sample calendar with events and metadata', () => {
    const parsed = parseIcsText(ICS_SAMPLE_CALENDAR);
    expect(parsed.meta.calendarName).toBe('Product Roadmap');
    expect(parsed.masters.length).toBeGreaterThanOrEqual(5);
    expect(parsed.masters.some((e) => e.title === 'Sprint kickoff')).toBe(true);
    expect(parsed.masters.some((e) => e.allDay && e.title === 'Design offsite')).toBe(true);
  });

  it('captures attendees, organizer, categories, and reminders', () => {
    const parsed = parseIcsText(ICS_SAMPLE_CALENDAR);
    const kickoff = parsed.masters.find((e) => e.title === 'Sprint kickoff');
    expect(kickoff).toBeTruthy();
    expect(kickoff?.organizer?.email).toContain('alex@example.com');
    expect(kickoff?.attendees.length).toBeGreaterThanOrEqual(2);
    expect(kickoff?.categories).toEqual(expect.arrayContaining(['Meetings', 'Planning']));
    expect(kickoff?.reminders.length).toBeGreaterThanOrEqual(1);
    expect(kickoff?.url).toContain('https://');
  });

  it('marks recurring events and expands occurrences in range', () => {
    const { masters, componentsByUid } = parseIcsWithComponents(ICS_SAMPLE_CALENDAR);
    const standup = masters.find((e) => e.title === 'Daily standup');
    expect(standup?.recurrence?.rrule).toMatch(/FREQ=WEEKLY/i);

    const start = new Date('2024-03-04T00:00:00Z');
    const end = new Date('2024-03-15T23:59:59Z');
    const expanded = expandEventsForRange(masters, start, end, componentsByUid);
    const standups = expanded.filter((e) => e.title === 'Daily standup');
    expect(standups.length).toBeGreaterThan(1);
    // EXDATE removes 2024-03-15
    expect(standups.every((e) => e.start.toISOString().slice(0, 10) !== '2024-03-15')).toBe(true);
  });

  it('rejects empty and non-calendar text', () => {
    expect(() => parseIcsText('')).toThrow(/empty/i);
    expect(() => parseIcsText('hello world')).toThrow(/BEGIN:VCALENDAR/i);
  });

  it('sanitizes URLs to http(s) only', () => {
    expect(sanitizeIcsUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(sanitizeIcsUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeIcsUrl('ftp://files.example')).toBeNull();
  });

  it('handles multi-day all-day events', () => {
    const parsed = parseIcsText(ICS_SAMPLE_CALENDAR);
    const offsite = parsed.masters.find((e) => e.title === 'Design offsite');
    expect(offsite?.allDay).toBe(true);
    expect(offsite?.spanDays).toBeGreaterThanOrEqual(3);
  });
});
