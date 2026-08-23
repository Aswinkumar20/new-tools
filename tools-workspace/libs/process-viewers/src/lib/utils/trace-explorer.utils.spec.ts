import { TRACE_EXPLORER_CSV_SAMPLE, TRACE_EXPLORER_JSON_SAMPLE, TRACE_EXPLORER_XES_SAMPLE } from '../constants/trace-explorer-sample.data';
import { filterTraceCases, parseTraceExplorerText } from './trace-explorer-parse.utils';
import {
  canExportTraceExplorer,
  createSampleTraceExplorerFile,
  createTraceExplorerFileRecord,
  exportTraceExplorerTracesCsv,
  filterValidTraceExplorerFiles
} from './trace-explorer.utils';

describe('trace-explorer-parse.utils', () => {
  it('parses insurance claim XES traces with attributes', () => {
    const parsed = parseTraceExplorerText(TRACE_EXPLORER_XES_SAMPLE, 'sample-claim-traces.xes');
    expect(parsed.sourceKind).toBe('xes');
    expect(parsed.name).toContain('Insurance');
    expect(parsed.traces.length).toBe(6);
    expect(parsed.steps.length).toBe(22);
    expect(parsed.attributes.some((a) => a.key === 'channel' && a.distinct === 3)).toBe(true);
    expect(parsed.traces[0].attributes.some((a) => a.key === 'priority' && a.value === 'high')).toBe(true);
  });

  it('parses trace JSON and CSV', () => {
    const json = parseTraceExplorerText(TRACE_EXPLORER_JSON_SAMPLE, 'traces.json');
    expect(json.sourceKind).toBe('json');
    expect(json.traces.length).toBe(6);
    const csv = parseTraceExplorerText(TRACE_EXPLORER_CSV_SAMPLE, 'traces.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.attributes.some((a) => a.key === 'amount')).toBe(true);
  });

  it('filters approve and reject traces', () => {
    const parsed = parseTraceExplorerText(TRACE_EXPLORER_XES_SAMPLE, 'sample.xes');
    expect(filterTraceCases(parsed.traces, 'reject').length).toBe(2);
    expect(filterTraceCases(parsed.traces, 'case:CLM1').length).toBe(1);
    expect(filterTraceCases(parsed.traces, 'channel=web').length).toBe(3);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseTraceExplorerText('')).toThrow(/empty/i);
    expect(() => parseTraceExplorerText('hello world')).toThrow(/No event log/i);
  });
});

describe('trace-explorer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTraceExplorerFile();
    expect(file.name).toBe('sample-claim-traces.xes');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample traces', () => {
    const file = createSampleTraceExplorerFile();
    const record = createTraceExplorerFileRecord(file, new TextEncoder().encode(TRACE_EXPLORER_XES_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.traces.length).toBe(6);
    expect(canExportTraceExplorer(record)).toBe(true);
  });

  it('exports traces csv', () => {
    const parsed = parseTraceExplorerText(TRACE_EXPLORER_XES_SAMPLE, 'sample.xes');
    const csv = exportTraceExplorerTracesCsv(parsed);
    expect(csv).toContain('index,case,events,duration_ms,path');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTraceExplorerFile();
    const { accepted, rejected } = filterValidTraceExplorerFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'traces.xes.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
