import {
  PROCESS_TIMELINE_CSV_SAMPLE,
  PROCESS_TIMELINE_JSON_SAMPLE,
  PROCESS_TIMELINE_XES_SAMPLE
} from '../constants/process-timeline-sample.data';
import { filterTimelineItems, parseProcessTimelineText } from './process-timeline-parse.utils';
import {
  canExportProcessTimeline,
  createProcessTimelineFileRecord,
  createSampleProcessTimelineFile,
  exportProcessTimelineCsv,
  filterValidProcessTimelineFiles
} from './process-timeline-viewer.utils';

describe('process-timeline-parse.utils', () => {
  it('parses the warehouse CSV timeline', () => {
    const parsed = parseProcessTimelineText(PROCESS_TIMELINE_CSV_SAMPLE, 'sample-warehouse-timeline.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.items.length).toBe(16);
    expect(parsed.caseLanes.length).toBe(4);
    expect(parsed.resourceLanes.length).toBeGreaterThanOrEqual(3);
    expect(parsed.endMs).toBeGreaterThan(parsed.startMs);
  });

  it('parses timeline XES and JSON', () => {
    const xes = parseProcessTimelineText(PROCESS_TIMELINE_XES_SAMPLE, 'timeline.xes');
    expect(xes.sourceKind).toBe('xes');
    expect(xes.name).toContain('Warehouse');
    expect(xes.items.length).toBe(16);
    const json = parseProcessTimelineText(PROCESS_TIMELINE_JSON_SAMPLE, 'timeline.json');
    expect(json.sourceKind).toBe('json');
    expect(json.caseLanes.length).toBe(4);
  });

  it('filters timeline items', () => {
    const parsed = parseProcessTimelineText(PROCESS_TIMELINE_CSV_SAMPLE, 'timeline.csv');
    expect(filterTimelineItems(parsed.items, 'case:W1').every((it) => it.caseId === 'W1')).toBe(true);
    expect(filterTimelineItems(parsed.items, 'activity:Pack').every((it) => /pack/i.test(it.activity))).toBe(true);
    expect(filterTimelineItems(parsed.items, 'resource:Cara').length).toBeGreaterThan(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseProcessTimelineText('')).toThrow(/empty/i);
    expect(() => parseProcessTimelineText('hello world')).toThrow(/No event log/i);
  });
});

describe('process-timeline-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleProcessTimelineFile();
    expect(file.name).toBe('sample-warehouse-timeline.csv');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample timeline', () => {
    const file = createSampleProcessTimelineFile();
    const record = createProcessTimelineFileRecord(file, new TextEncoder().encode(PROCESS_TIMELINE_CSV_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.items.length).toBe(16);
    expect(canExportProcessTimeline(record)).toBe(true);
  });

  it('exports timeline csv', () => {
    const parsed = parseProcessTimelineText(PROCESS_TIMELINE_CSV_SAMPLE, 'timeline.csv');
    const csv = exportProcessTimelineCsv(parsed);
    expect(csv).toContain('index,case,activity,resource,start,end,duration_ms');
    expect(csv.split('\n').length).toBe(17);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleProcessTimelineFile();
    const { accepted, rejected } = filterValidProcessTimelineFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'timeline.csv.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
