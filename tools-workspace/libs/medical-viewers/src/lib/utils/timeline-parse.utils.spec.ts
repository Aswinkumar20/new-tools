import { buildSampleTimelineJson, filterTimelineEvents, parseTimelineText } from './timeline-parse.utils';

describe('timeline-parse.utils', () => {
  it('parses sample JSON timeline', () => {
    const parsed = parseTimelineText(buildSampleTimelineJson(), '.json');
    expect(parsed.patientLabel).toBe('John Doe');
    expect(parsed.events.length).toBe(5);
    expect(parsed.format).toBe('json');
  });

  it('filters events by category', () => {
    const parsed = parseTimelineText(buildSampleTimelineJson(), '.json');
    const filtered = filterTimelineEvents(parsed.events, '', 'lab');
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toContain('CBC');
  });
});
