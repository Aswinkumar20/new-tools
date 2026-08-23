import { buildSampleHl7Message, filterHl7Segments, parseHl7Text } from './hl7-parse.utils';

describe('hl7-parse.utils', () => {
  it('parses sample ORU^R01 message with MSH metadata', () => {
    const parsed = parseHl7Text(buildSampleHl7Message());
    expect(parsed.messageType).toBe('ORU');
    expect(parsed.triggerEvent).toBe('R01');
    expect(parsed.version).toBe('2.5');
    expect(parsed.segments.some((s) => s.name === 'PID')).toBe(true);
    expect(parsed.segments.some((s) => s.name === 'OBX')).toBe(true);
  });

  it('labels PID patient id field', () => {
    const parsed = parseHl7Text(buildSampleHl7Message());
    const pid = parsed.segments.find((s) => s.name === 'PID');
    expect(pid?.fields[3]?.label).toBe('Patient ID');
  });

  it('filters segments by query', () => {
    const parsed = parseHl7Text(buildSampleHl7Message());
    const filtered = filterHl7Segments(parsed.segments, 'OBX');
    expect(filtered.every((s) => s.name === 'OBX')).toBe(true);
  });

  it('warns when MSH segment is missing', () => {
    const parsed = parseHl7Text('PID|1||12345^^^MRN||DOE^JOHN');
    expect(parsed.warnings.some((w) => w.includes('MSH'))).toBe(true);
  });
});
