import { SYSLOG_CSV_SAMPLE, SYSLOG_LOG_SAMPLE } from '../constants/syslog-sample.data';
import { filterSyslogMessages, parseSyslogText } from './syslog-parse.utils';
import {
  canExportSyslog,
  createSampleSyslogFile,
  createSyslogFileRecord,
  exportSyslogMessagesCsv,
  filterValidSyslogFiles
} from './syslog-viewer.utils';

describe('syslog-parse.utils', () => {
  it('parses the edge RFC 3164/5424 sample', () => {
    const parsed = parseSyslogText(SYSLOG_LOG_SAMPLE);
    expect(parsed.name).toContain('Edge');
    expect(parsed.sourceKind).toBe('log');
    expect(parsed.messages.length).toBe(10);
    expect(parsed.messages.some((m) => m.facility === 'auth' && m.severity === 'crit')).toBe(true);
    expect(parsed.messages.some((m) => m.facility === 'local4')).toBe(true);
    expect(parsed.messages.some((m) => m.app === 'sshd')).toBe(true);
    expect(parsed.severities.some((s) => s.name === 'err')).toBe(true);
  });

  it('parses syslog CSV', () => {
    const parsed = parseSyslogText(SYSLOG_CSV_SAMPLE, 'syslog.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.messages.length).toBe(3);
    expect(parsed.messages[0].facility).toBe('auth');
  });

  it('filters by severity, facility, and host', () => {
    const parsed = parseSyslogText(SYSLOG_LOG_SAMPLE);
    expect(filterSyslogMessages(parsed.messages, 'crit').every((m) => m.severity === 'crit')).toBe(true);
    expect(filterSyslogMessages(parsed.messages, 'kern').every((m) => m.facility === 'kern')).toBe(true);
    expect(filterSyslogMessages(parsed.messages, 'host:gw').length).toBeGreaterThan(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSyslogText('')).toThrow(/empty/i);
    expect(() => parseSyslogText('hello world')).toThrow(/No syslog|messages/i);
  });
});

describe('syslog-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSyslogFile();
    expect(file.name).toBe('sample-edge-syslog.log');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleSyslogFile();
    const record = createSyslogFileRecord(file, new TextEncoder().encode(SYSLOG_LOG_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.messages.length).toBe(10);
    expect(canExportSyslog(record)).toBe(true);
  });

  it('exports messages csv', () => {
    const parsed = parseSyslogText(SYSLOG_LOG_SAMPLE);
    const csv = exportSyslogMessagesCsv(parsed);
    expect(csv).toContain('index,time,facility,severity');
    expect(csv.split('\n').length).toBe(11);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSyslogFile();
    const { accepted, rejected } = filterValidSyslogFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'syslog.log.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
