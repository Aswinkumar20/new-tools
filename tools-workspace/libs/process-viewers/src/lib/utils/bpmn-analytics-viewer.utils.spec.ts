import { BPMN_ANALYTICS_CSV_SAMPLE, BPMN_ANALYTICS_JSON_SAMPLE } from '../constants/bpmn-analytics-sample.data';
import { BPMN_SAMPLE_XML } from '../constants/bpmn-viewer.constants';
import { filterBpmnAnalyticsActivities, parseBpmnAnalyticsText } from './bpmn-analytics-parse.utils';
import {
  canExportBpmnAnalytics,
  createBpmnAnalyticsFileRecord,
  createSampleBpmnAnalyticsFile,
  exportBpmnAnalyticsActivitiesCsv,
  filterValidBpmnAnalyticsFiles,
  resolveBpmnAnalyticsSuggestion
} from './bpmn-analytics-viewer.utils';

describe('bpmn-analytics-parse.utils', () => {
  it('parses the order fulfillment analytics sample', () => {
    const parsed = parseBpmnAnalyticsText(BPMN_ANALYTICS_JSON_SAMPLE);
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.processName).toBe('Order Fulfillment');
    expect(parsed.cases).toBe(1280);
    expect(parsed.activities.length).toBe(6);
    expect(parsed.flows.length).toBe(6);
    expect(parsed.activities.some((a) => a.id === 'Task_Backorder' && a.severity === 'critical')).toBe(true);
    expect(parsed.activities.some((a) => a.id === 'Task_Ship' && (a.severity === 'high' || a.severity === 'critical'))).toBe(true);
    expect(parsed.activities[0].bottleneckScore).toBeGreaterThanOrEqual(parsed.activities[parsed.activities.length - 1].bottleneckScore);
  });

  it('parses BPMN XML structure and CSV metrics', () => {
    const bpmn = parseBpmnAnalyticsText(BPMN_SAMPLE_XML, 'order.bpmn');
    expect(bpmn.sourceKind).toBe('bpmn');
    expect(bpmn.processName).toContain('Order');
    expect(bpmn.activities.some((a) => a.id === 'Task_Review')).toBe(true);
    expect(bpmn.warnings.some((w) => /metrics/i.test(w))).toBe(true);
    const csv = parseBpmnAnalyticsText(BPMN_ANALYTICS_CSV_SAMPLE, 'lab.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.activities.length).toBe(3);
    expect(csv.activities.some((a) => a.id === 'Task_Backorder')).toBe(true);
  });

  it('filters by severity, kind, and bottleneck', () => {
    const parsed = parseBpmnAnalyticsText(BPMN_ANALYTICS_JSON_SAMPLE);
    expect(filterBpmnAnalyticsActivities(parsed.activities, 'critical').every((a) => a.severity === 'critical')).toBe(true);
    expect(filterBpmnAnalyticsActivities(parsed.activities, 'task').every((a) => a.kind === 'task')).toBe(true);
    expect(filterBpmnAnalyticsActivities(parsed.activities, 'bottleneck').every((a) => a.severity === 'critical' || a.severity === 'high')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseBpmnAnalyticsText('')).toThrow(/empty/i);
    expect(() => parseBpmnAnalyticsText('hello world')).toThrow(/No BPMN analytics/i);
  });
});

describe('bpmn-analytics-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleBpmnAnalyticsFile();
    expect(file.name).toBe('sample-order-analytics.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample json', () => {
    const file = createSampleBpmnAnalyticsFile();
    const record = createBpmnAnalyticsFileRecord(file, new TextEncoder().encode(BPMN_ANALYTICS_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.activities.length).toBe(6);
    expect(canExportBpmnAnalytics(record)).toBe(true);
  });

  it('exports activities csv', () => {
    const parsed = parseBpmnAnalyticsText(BPMN_ANALYTICS_JSON_SAMPLE);
    const csv = exportBpmnAnalyticsActivitiesCsv(parsed);
    expect(csv).toContain('index,id,name,kind,severity,frequency');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleBpmnAnalyticsFile();
    const { accepted, rejected } = filterValidBpmnAnalyticsFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'lab.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveBpmnAnalyticsSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveBpmnAnalyticsSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveBpmnAnalyticsSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveBpmnAnalyticsSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.json', { lastModified: 9 });
    const record = createBpmnAnalyticsFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportBpmnAnalytics(record)).toBe(false);
  });

  it('canExportBpmnAnalytics returns false for null', () => {
    expect(canExportBpmnAnalytics(null)).toBe(false);
  });
});
