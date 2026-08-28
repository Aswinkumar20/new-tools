import { WORKFLOW_CSV_SAMPLE, WORKFLOW_JSON_SAMPLE, WORKFLOW_XML_SAMPLE } from '../constants/workflow-sample.data';
import { filterWorkflowNodes, parseWorkflowText } from './workflow-parse.utils';
import {
  canExportWorkflow,
  createSampleWorkflowFile,
  createWorkflowFileRecord,
  exportWorkflowNodesCsv,
  filterValidWorkflowFiles,
  resolveWorkflowSuggestion
} from './workflow-diagram-viewer.utils';

describe('workflow-parse.utils', () => {
  it('parses the support ticket workflow XML sample', () => {
    const parsed = parseWorkflowText(WORKFLOW_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('xml');
    expect(parsed.name).toContain('Support');
    expect(parsed.nodes.length).toBe(8);
    expect(parsed.edges.length).toBe(8);
    expect(parsed.nodes.some((n) => n.kind === 'start' && /Ticket opened/i.test(n.name))).toBe(true);
    expect(parsed.nodes.some((n) => n.kind === 'decision')).toBe(true);
    expect(parsed.nodes.some((n) => n.kind === 'join')).toBe(true);
    expect(parsed.edges.some((e) => e.label === 'high')).toBe(true);
  });

  it('parses workflow JSON and CSV', () => {
    const json = parseWorkflowText(WORKFLOW_JSON_SAMPLE, 'ticket.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(5);
    expect(json.edges.length).toBe(4);
    const csv = parseWorkflowText(WORKFLOW_CSV_SAMPLE, 'ticket.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.nodes.length).toBe(5);
    expect(csv.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('filters nodes by kind', () => {
    const parsed = parseWorkflowText(WORKFLOW_XML_SAMPLE);
    expect(filterWorkflowNodes(parsed.nodes, 'task').every((n) => n.kind === 'task')).toBe(true);
    expect(filterWorkflowNodes(parsed.nodes, 'kind:decision').length).toBe(1);
    expect(filterWorkflowNodes(parsed.nodes, 'node:Triage').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseWorkflowText('')).toThrow(/empty/i);
    expect(() => parseWorkflowText('hello world')).toThrow(/No workflow/i);
  });
});

describe('workflow-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleWorkflowFile();
    expect(file.name).toBe('sample-support-ticket.xml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample workflow', () => {
    const file = createSampleWorkflowFile();
    const record = createWorkflowFileRecord(file, new TextEncoder().encode(WORKFLOW_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(8);
    expect(canExportWorkflow(record)).toBe(true);
  });

  it('exports nodes csv', () => {
    const parsed = parseWorkflowText(WORKFLOW_XML_SAMPLE);
    const csv = exportWorkflowNodesCsv(parsed);
    expect(csv).toContain('index,kind,id,name,incoming,outgoing');
    expect(csv.split('\n').length).toBe(9);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleWorkflowFile();
    const { accepted, rejected } = filterValidWorkflowFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'flow.xml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveWorkflowSuggestion returns upload-or-sample when empty', () => {
    expect(resolveWorkflowSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveWorkflowSuggestion returns sample-after-error when hasError', () => {
    expect(resolveWorkflowSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportWorkflow returns false for null', () => {
    expect(canExportWorkflow(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createWorkflowFileRecord(new File(['hello world'], 'bad.xml', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportWorkflow(record)).toBe(false);
  });
});
