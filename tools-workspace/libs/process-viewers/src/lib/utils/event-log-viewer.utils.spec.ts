import { EVENT_LOG_CSV_SAMPLE, EVENT_LOG_JSON_SAMPLE, EVENT_LOG_XES_SAMPLE } from '../constants/event-log-sample.data';
import { filterEventLogActivities, filterEventLogCases, parseEventLogText } from './event-log-parse.utils';
import {
  canExportEventLog,
  createEventLogFileRecord,
  createSampleEventLogFile,
  exportEventLogCasesCsv,
  filterValidEventLogFiles,
  resolveEventLogSuggestion
} from './event-log-viewer.utils';

describe('event-log-parse.utils', () => {
  it('parses the support ticket CSV sample', () => {
    const parsed = parseEventLogText(EVENT_LOG_CSV_SAMPLE, 'sample-ticket-log.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.cases.length).toBe(6);
    expect(parsed.events.length).toBe(30);
    expect(parsed.activities.some((a) => a.name === 'Triage' && a.frequency === 6)).toBe(true);
    expect(parsed.cases[0].caseId).toBe('T1');
  });

  it('parses event log XES and JSON', () => {
    const xes = parseEventLogText(EVENT_LOG_XES_SAMPLE, 'ticket.xes');
    expect(xes.sourceKind).toBe('xes');
    expect(xes.name).toContain('Support');
    expect(xes.cases.length).toBe(6);
    const json = parseEventLogText(EVENT_LOG_JSON_SAMPLE, 'ticket.json');
    expect(json.sourceKind).toBe('json');
    expect(json.events.length).toBe(30);
  });

  it('filters cases and activities', () => {
    const parsed = parseEventLogText(EVENT_LOG_CSV_SAMPLE, 'ticket.csv');
    expect(filterEventLogCases(parsed.cases, 'case:T1').length).toBe(1);
    expect(filterEventLogActivities(parsed.activities, 'activity:Triage').length).toBe(1);
    expect(filterEventLogCases(parsed.cases, 'long').every((c) => c.events >= 5)).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseEventLogText('')).toThrow(/empty/i);
    expect(() => parseEventLogText('hello world')).toThrow(/No event log/i);
  });
});

describe('event-log-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleEventLogFile();
    expect(file.name).toBe('sample-ticket-log.csv');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample log', () => {
    const file = createSampleEventLogFile();
    const record = createEventLogFileRecord(file, new TextEncoder().encode(EVENT_LOG_CSV_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.cases.length).toBe(6);
    expect(canExportEventLog(record)).toBe(true);
  });

  it('exports cases csv', () => {
    const parsed = parseEventLogText(EVENT_LOG_CSV_SAMPLE, 'ticket.csv');
    const csv = exportEventLogCasesCsv(parsed);
    expect(csv).toContain('index,case,events,duration_ms,path');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleEventLogFile();
    const { accepted, rejected } = filterValidEventLogFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'log.csv.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveEventLogSuggestion returns upload-or-sample when empty', () => {
    expect(resolveEventLogSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveEventLogSuggestion returns sample-after-error when hasError', () => {
    expect(resolveEventLogSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportEventLog returns false for null', () => {
    expect(canExportEventLog(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createEventLogFileRecord(new File(['hello world'], 'bad.csv', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportEventLog(record)).toBe(false);
  });
});
