import {
  attrValue,
  buildXesActivityCounts,
  buildXesLogInsights,
  buildXesLogMetadata,
  buildXesLogStats,
  buildXesTraceSummaries,
  buildXesVariantCounts,
  exportXesCasesAsCsv,
  exportXesCasesAsJson,
  exportXesDfgAsDot,
  exportXesEventsAsCsv,
  exportXesEventsAsJson,
  exportXesFullReportAsCsv,
  exportXesFullReportAsPdf,
  exportXesMarkdownReport,
  exportXesSummaryAsJson,
  exportXesTimelineAsCsv,
  filterValidXesFiles,
  filterXesEventRows,
  flattenXesEvents,
  formatXesDuration,
  formatXesFileSize,
  getPm4jsImporter,
  getPm4jsStatistics,
  getXesFileExtension,
  isSupportedXesFile,
  parseXesWithPm4js,
  resolveXesSuggestion,
  validateXesFileSize
} from './xes-viewer.utils';
import type { Pm4jsEventLog, Pm4jsXesImporter } from '../types/xes-viewer.types';

function sampleLog(): Pm4jsEventLog {
  return {
    attributes: {},
    extensions: {},
    globals: {},
    classifiers: {},
    traces: [
      {
        attributes: { 'concept:name': { value: 'CaseA' } },
        events: [
          {
            attributes: {
              'concept:name': { value: 'Register' },
              'time:timestamp': { value: new Date('2024-01-01T10:00:00Z') },
              'org:resource': { value: 'Alice' },
              'lifecycle:transition': { value: 'complete' }
            }
          },
          {
            attributes: {
              'concept:name': { value: 'Approve' },
              'time:timestamp': { value: new Date('2024-01-01T11:00:00Z') },
              'org:resource': { value: 'Bob' },
              'lifecycle:transition': { value: 'complete' }
            }
          }
        ]
      },
      {
        attributes: { 'concept:name': { value: 'CaseB' } },
        events: [
          {
            attributes: {
              'concept:name': { value: 'Register' },
              'time:timestamp': { value: new Date('2024-01-02T09:00:00Z') },
              'org:resource': { value: 'Alice' }
            }
          }
        ]
      }
    ]
  };
}

describe('xes-viewer.utils', () => {
  it('detects supported XES files', () => {
    expect(isSupportedXesFile({ name: 'log.xes', type: '' })).toBe(true);
    expect(isSupportedXesFile({ name: 'log.xml', type: 'application/xml' })).toBe(true);
    expect(isSupportedXesFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(filterValidXesFiles([new File([''], 'a.xes'), new File([''], 'b.txt')])).toHaveLength(1);
    expect(getXesFileExtension('Sample.XES')).toBe('.xes');
  });

  it('formats sizes and validates limits', () => {
    expect(formatXesFileSize(0)).toBe('0 Bytes');
    expect(formatXesFileSize(2048)).toContain('KB');
    expect(validateXesFileSize({ name: 'ok.xes', size: 1024 })).toBeNull();
    expect(validateXesFileSize({ name: 'big.xes', size: 60 * 1024 * 1024 })).toContain('max');
  });

  it('parses with PM4JS importer and rejects invalid XML', () => {
    const importer: Pm4jsXesImporter = {
      apply: jest.fn().mockReturnValue(sampleLog())
    };
    const log = parseXesWithPm4js('<log></log>', importer);
    expect(log.traces).toHaveLength(2);
    expect(importer.apply).toHaveBeenCalled();

    expect(() => parseXesWithPm4js('not xml', importer)).toThrow(/valid XES/i);
    expect(() => parseXesWithPm4js('   ', importer)).toThrow(/empty/i);
  });

  it('flattens events, builds summaries, filters, and exports CSV', () => {
    const log = sampleLog();
    const rows = flattenXesEvents(log);
    expect(rows).toHaveLength(3);
    expect(rows[0].caseId).toBe('CaseA');
    expect(rows[0].activity).toBe('Register');
    expect(attrValue(log.traces[0].attributes, 'concept:name')).toBe('CaseA');

    const traces = buildXesTraceSummaries(log);
    expect(traces[0].eventCount).toBe(2);
    expect(traces[0].activities).toEqual(['Register', 'Approve']);

    const activities = buildXesActivityCounts(rows);
    expect(activities[0]).toEqual({ name: 'Register', count: 2 });

    const variants = buildXesVariantCounts(log);
    expect(variants.some((v) => v.name.includes('Register'))).toBe(true);

    const stats = buildXesLogStats(log, rows);
    expect(stats.cases).toBe(2);
    expect(stats.events).toBe(3);
    expect(stats.activities).toBe(2);

    const filtered = filterXesEventRows(rows, {
      searchText: 'approve',
      caseId: null,
      activity: null
    });
    expect(filtered).toHaveLength(1);

    const csv = exportXesEventsAsCsv(filtered);
    expect(csv.split('\n')[0]).toBe(
      'case_id,concept:name,lifecycle:transition,org:resource,time:timestamp'
    );
    expect(csv).toContain('Approve');
  });

  it('reports PM4JS as absent before the modules are imported', () => {
    expect(getPm4jsImporter()).toBeNull();
    expect(getPm4jsStatistics()).toBeUndefined();
  });

  it('reads XES header metadata', () => {
    const log = sampleLog();
    log.attributes = { 'concept:name': { value: 'Purchase Log' } };
    log.extensions = { Concept: ['concept', 'http://www.xes-standard.org/concept.xesext'] };
    log.classifiers = { Activity: 'concept:name' };
    log.globals = { event: { attributes: { 'concept:name': { value: '__INVALID__' } } } };

    const meta = buildXesLogMetadata(log, flattenXesEvents(log));

    expect(meta.name).toBe('Purchase Log');
    expect(meta.extensions[0]).toEqual({
      name: 'Concept',
      prefix: 'concept',
      uri: 'http://www.xes-standard.org/concept.xesext'
    });
    expect(meta.classifiers[0]).toEqual({ name: 'Activity', keys: 'concept:name' });
    expect(meta.globals[0].scope).toBe('event');
    expect(meta.eventAttributeKeys).toContain('org:resource');
    expect(meta.traceAttributeKeys).toEqual(['concept:name']);
  });

  it('formats durations across units', () => {
    expect(formatXesDuration(null, 1)).toBe('—');
    expect(formatXesDuration(0, 30_000)).toBe('30s');
    expect(formatXesDuration(0, 5 * 60_000)).toBe('5m');
    expect(formatXesDuration(0, 90 * 60_000)).toBe('1h 30m');
    expect(formatXesDuration(0, 26 * 3_600_000)).toBe('1d 2h');
  });

  it('builds process insights and multi-format exports', async () => {
    const log = sampleLog();
    const rows = flattenXesEvents(log);
    const traces = buildXesTraceSummaries(log);
    const variants = buildXesVariantCounts(log);
    const insights = buildXesLogInsights(log, rows, traces, variants);

    expect(insights.avgEventsPerCase).toBe(1.5);
    expect(insights.medianEventsPerCase).toBe(1.5);
    expect(insights.minEventsPerCase).toBe(1);
    expect(insights.startActivities[0].name).toBe('Register');
    expect(insights.transitions.some((item) => item.name === 'Register → Approve')).toBe(true);
    expect(insights.caseLengthBuckets.length).toBeGreaterThan(0);
    expect(insights.findings.length).toBeGreaterThan(0);
    expect(insights.variantPareto[0].cumulativeShare).toBeGreaterThan(0);
    expect(insights.hourlyBuckets.length).toBeGreaterThan(0);

    expect(exportXesEventsAsCsv(rows, '\t')).toContain('\t');
    expect(exportXesEventsAsJson(rows)).toContain('"caseId": "CaseA"');
    expect(exportXesCasesAsCsv(traces)).toContain('case_id,event_count');
    expect(exportXesCasesAsJson(traces)).toContain('"path"');
    expect(exportXesTimelineAsCsv(rows)).toContain('relative_seconds');
    expect(exportXesDfgAsDot(insights.transitions)).toContain('digraph XES_DFG');

    const reportPayload = {
      fileName: 'demo.xes',
      stats: buildXesLogStats(log, rows),
      metadata: buildXesLogMetadata(log, rows),
      insights,
      activities: buildXesActivityCounts(rows),
      variants
    };
    expect(exportXesMarkdownReport(reportPayload)).toContain('# XES analytics report');
    expect(exportXesSummaryAsJson(reportPayload)).toContain('"avgEventsPerCase"');
    expect(exportXesFullReportAsCsv(reportPayload)).toContain('section,item,value');
    expect(exportXesFullReportAsCsv(reportPayload)).toContain('Findings');

    const pdfBytes = await exportXesFullReportAsPdf(reportPayload);
    expect(pdfBytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3])).toBe('%PDF');
  });

  it('resolves contextual suggestions', () => {
    expect(resolveXesSuggestion({ hasFiles: false, hasError: false, eventCount: 0 })?.id).toBe(
      'xes-intro'
    );
    expect(resolveXesSuggestion({ hasFiles: true, hasError: true, eventCount: 0 })?.id).toBe(
      'xes-meta'
    );
    expect(resolveXesSuggestion({ hasFiles: true, hasError: false, eventCount: 9000 })?.id).toBe(
      'xes-large'
    );
    expect(resolveXesSuggestion({ hasFiles: true, hasError: false, eventCount: 10 })?.id).toBe(
      'xes-log'
    );
  });
});
