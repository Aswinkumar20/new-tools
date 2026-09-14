import {
  filterSubtitleCues,
  formatCueTimestamp,
  parseCueTimestamp,
  parseSrt,
  parseVtt
} from './subtitle-viewer.utils';

describe('subtitle-viewer.utils', () => {
  it('parses SRT cues', () => {
    const cues = parseSrt(`1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:07,500
Second line`);
    expect(cues).toHaveLength(2);
    expect(cues[0]?.text).toBe('Hello world');
    expect(cues[1]?.startSeconds).toBeCloseTo(5);
  });

  it('parses VTT cues', () => {
    const cues = parseVtt(`WEBVTT

00:00:01.000 --> 00:00:04.000
Hello`);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.endSeconds).toBeCloseTo(4);
  });

  it('formats and parses timestamps', () => {
    expect(parseCueTimestamp('1:05.500')).toBeCloseTo(65.5);
    expect(formatCueTimestamp(65.5)).toBe('1:05.500');
  });

  it('filters cues by query', () => {
    const cues = parseSrt(`1
00:00:00,000 --> 00:00:01,000
Alpha

2
00:00:01,000 --> 00:00:02,000
Beta`);
    expect(filterSubtitleCues(cues, 'beta')).toHaveLength(1);
  });
});
