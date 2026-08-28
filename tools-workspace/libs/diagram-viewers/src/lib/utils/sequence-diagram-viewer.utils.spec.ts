import {
  SEQ_JSON_SAMPLE,
  SEQ_MARKDOWN_SAMPLE,
  SEQ_MERMAID_SAMPLE,
  SEQ_PUML_SAMPLE,
  SEQ_XML_SAMPLE
} from '../constants/sequence-diagram-viewer-sample.data';
import { filterSeqLifelines, filterSeqMessages, parseSequenceText } from './sequence-diagram-viewer-parse.utils';
import { canExportSeq, createSampleSeqFile, createSeqFileRecord, exportSeqLifelinesCsv, filterValidSeqFiles, resolveSeqSuggestion } from './sequence-diagram-viewer.utils';

describe('sequence-diagram-viewer-parse.utils', () => {
  it('parses the checkout sequence sample', () => {
    const parsed = parseSequenceText(SEQ_PUML_SAMPLE, 'sample-checkout-seq.puml');
    expect(parsed.title).toBe('Checkout interaction');
    expect(parsed.lifelines.length).toBe(3);
    expect(parsed.messages.length).toBe(4);
    expect(parsed.lifelines.some((l) => l.kind === 'actor' && l.name === 'User')).toBe(true);
    expect(parsed.messages.some((m) => m.label === 'Charge')).toBe(true);
    expect(parsed.messages.some((m) => m.style === 'return')).toBe(true);
  });

  it('parses mermaid, markdown fence, JSON, and XML', () => {
    const mermaid = parseSequenceText(SEQ_MERMAID_SAMPLE, 'pay.mmd');
    expect(mermaid.sourceKind).toBe('mermaid');
    expect(mermaid.lifelines.length).toBe(2);
    expect(mermaid.messages.length).toBe(2);
    expect(mermaid.lifelines.find((l) => l.id === 'U')?.name).toBe('User');

    const md = parseSequenceText(SEQ_MARKDOWN_SAMPLE, 'cart.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.lifelines.length).toBe(2);
    expect(md.messages.length).toBe(2);

    const json = parseSequenceText(SEQ_JSON_SAMPLE, 'checkout.json');
    expect(json.sourceKind).toBe('json');
    expect(json.lifelines.length).toBe(3);
    expect(json.messages.length).toBe(3);

    const xml = parseSequenceText(SEQ_XML_SAMPLE, 'checkout.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.lifelines.length).toBe(2);
    expect(xml.messages.length).toBe(2);
  });

  it('filters lifelines and messages', () => {
    const parsed = parseSequenceText(SEQ_PUML_SAMPLE, 'checkout.puml');
    expect(filterSeqLifelines(parsed.lifelines, 'kind:actor').every((l) => l.kind === 'actor')).toBe(true);
    expect(filterSeqMessages(parsed.messages, 'msg:Charge').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSequenceText('')).toThrow(/empty/i);
    expect(() => parseSequenceText('hello world')).toThrow(/Not a sequence/i);
  });
});

describe('sequence-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSeqFile();
    expect(file.name).toBe('sample-checkout-seq.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample sequence', () => {
    const file = createSampleSeqFile();
    const record = createSeqFileRecord(file, new TextEncoder().encode(SEQ_PUML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.lifelines.length).toBe(3);
    expect(canExportSeq(record)).toBe(true);
  });

  it('exports lifelines csv', () => {
    const parsed = parseSequenceText(SEQ_PUML_SAMPLE, 'checkout.puml');
    const csv = exportSeqLifelinesCsv(parsed);
    expect(csv).toContain('index,id,name,kind,alias');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSeqFile();
    const { accepted, rejected } = filterValidSeqFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'checkout.puml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveSeqSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveSeqSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSeqSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSeqSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createSeqFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportSeq(record)).toBe(false);
  });

  it('canExportSeq returns false for null', () => {
    expect(canExportSeq(null)).toBe(false);
  });
});
