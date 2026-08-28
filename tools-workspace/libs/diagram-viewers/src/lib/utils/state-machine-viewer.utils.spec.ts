import {
  SM_JSON_SAMPLE,
  SM_MARKDOWN_SAMPLE,
  SM_SAMPLE,
  SM_XML_SAMPLE
} from '../constants/state-machine-viewer-sample.data';
import { filterSmStates, filterSmTransitions, parseStateMachineText } from './state-machine-viewer-parse.utils';
import {
  canExportSm,
  createSampleSmFile,
  createSmFileRecord,
  exportSmStatesCsv,
  filterValidSmFiles,
  resolveSmSuggestion
} from './state-machine-viewer.utils';

describe('state-machine-viewer-parse.utils', () => {
  it('parses the shop SCXML sample', () => {
    const parsed = parseStateMachineText(SM_SAMPLE, 'sample-shop.scxml');
    expect(parsed.sourceKind).toBe('scxml');
    expect(parsed.states.length).toBe(4);
    expect(parsed.transitions.length).toBeGreaterThanOrEqual(4);
    expect(parsed.initial).toBe('idle');
    expect(parsed.states.some((s) => s.id === 'idle' && s.kind === 'initial')).toBe(true);
    expect(parsed.states.some((s) => s.id === 'done' && s.kind === 'final')).toBe(true);
    expect(parsed.transitions.some((t) => t.event === 'start' && t.target === 'cart')).toBe(true);
    expect(parsed.transitions.some((t) => t.event === 'paid')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseStateMachineText(SM_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.states.length).toBeGreaterThanOrEqual(3);
    expect(md.transitions.length).toBeGreaterThanOrEqual(2);
    expect(md.initial).toBe('idle');

    const json = parseStateMachineText(SM_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.states.length).toBe(3);
    expect(json.transitions.length).toBe(2);

    const xml = parseStateMachineText(SM_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.states.length).toBe(3);
    expect(xml.transitions.length).toBe(2);
  });

  it('filters states and transitions', () => {
    const parsed = parseStateMachineText(SM_SAMPLE, 'shop.scxml');
    expect(filterSmStates(parsed.states, 'kind:final').some((s) => s.id === 'done')).toBe(true);
    expect(filterSmStates(parsed.states, 'state:cart').length).toBe(1);
    expect(filterSmTransitions(parsed.transitions, 'event:checkout').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseStateMachineText('')).toThrow(/empty/i);
    expect(() => parseStateMachineText('hello world')).toThrow(/Not a state machine/i);
  });
});

describe('state-machine-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSmFile();
    expect(file.name).toBe('sample-shop.scxml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample scxml', () => {
    const file = createSampleSmFile();
    const record = createSmFileRecord(file, new TextEncoder().encode(SM_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.states.length).toBe(4);
    expect(canExportSm(record)).toBe(true);
  });

  it('exports states csv', () => {
    const parsed = parseStateMachineText(SM_SAMPLE, 'shop.scxml');
    const csv = exportSmStatesCsv(parsed);
    expect(csv).toContain('index,id,name,kind');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSmFile();
    const { accepted, rejected } = filterValidSmFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.scxml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveSmSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveSmSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSmSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSmSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createSmFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportSm(record)).toBe(false);
  });

  it('canExportSm returns false for null', () => {
    expect(canExportSm(null)).toBe(false);
  });
});
