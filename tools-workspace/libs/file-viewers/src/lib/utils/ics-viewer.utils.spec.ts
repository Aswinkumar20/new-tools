import { ICS_SAMPLE_CALENDAR } from '../constants/ics-viewer-sample.data';
import {
  activeFilterCount,
  buildMonthGrid,
  filterEvents,
  filterValidIcsFiles,
  formatViewTitle,
  navigateAnchor,
  startOfDay,
  visibleRangeForView
} from './ics-viewer.utils';
import { parseIcsText } from './ics-viewer-parse.utils';
import type { IcsFilterState } from '../types/ics-viewer.types';

describe('ics-viewer.utils', () => {
  it('validates supported ICS files and size', () => {
    const ok = new File(['BEGIN:VCALENDAR'], 'team.ics', { type: 'text/calendar' });
    const bad = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const { valid, errors } = filterValidIcsFiles([ok, bad]);
    expect(valid).toHaveLength(1);
    expect(errors[0]).toMatch(/not a supported/i);
  });

  it('filters by search title and location', () => {
    const { masters } = parseIcsText(ICS_SAMPLE_CALENDAR);
    const filters: IcsFilterState = {
      search: 'austin',
      categories: [],
      statuses: [],
      calendars: [],
      allDayOnly: false,
      recurringOnly: false,
      hasAttendeesOnly: false
    };
    const filtered = filterEvents(masters, filters);
    expect(filtered.every((e) => (e.location ?? '').toLowerCase().includes('austin'))).toBe(true);
  });

  it('counts active filters', () => {
    expect(
      activeFilterCount({
        search: 'x',
        categories: ['A'],
        statuses: [],
        calendars: [],
        allDayOnly: true,
        recurringOnly: false,
        hasAttendeesOnly: false
      })
    ).toBe(3);
  });

  it('builds a month grid with today/selection flags', () => {
    const anchor = new Date(2024, 2, 15);
    const grid = buildMonthGrid(anchor, [], startOfDay(anchor), startOfDay(anchor));
    expect(grid).toHaveLength(42);
    expect(grid.some((c) => c.isSelected)).toBe(true);
  });

  it('navigates anchors per view mode', () => {
    const day = new Date(2024, 2, 15);
    expect(navigateAnchor('day', day, 1).getDate()).toBe(16);
    expect(navigateAnchor('week', day, 1).getDate()).toBe(22);
    expect(navigateAnchor('month', day, 1).getMonth()).toBe(3);
    expect(navigateAnchor('year', day, 1).getFullYear()).toBe(2025);
  });

  it('computes visible ranges and titles', () => {
    const anchor = new Date(2024, 2, 15);
    const monthRange = visibleRangeForView('month', anchor);
    expect(monthRange.start.getTime()).toBeLessThan(monthRange.end.getTime());
    expect(formatViewTitle('year', anchor)).toBe('2024');
    expect(formatViewTitle('day', anchor)).toMatch(/March/);
  });
});
