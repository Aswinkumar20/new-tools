import { AV_AVSC_SAMPLE, AV_JSON_SAMPLE, AV_MARKDOWN_SAMPLE } from '../constants/avro-viewer-sample.data';
import { buildSampleAvroBytes, filterAvFields, filterAvRecords, parseAvroBytes, parseAvroText } from './avro-viewer-parse.utils';
import {
  canExportAv,
  createAvFileRecord,
  createSampleAvFile,
  exportAvSchemaCsv,
  filterValidAvFiles,
  resolveAvSuggestion
} from './avro-viewer.utils';

describe('avro-viewer-parse.utils', () => {
  it('parses the clickstream Avro sample', () => {
    const parsed = parseAvroBytes(buildSampleAvroBytes(), 'clickstream.avro');
    expect(parsed.sourceKind).toBe('avro');
    expect(parsed.namespace).toBe('com.events');
    expect(parsed.recordName).toBe('ClickEvent');
    expect(parsed.fields.length).toBe(4);
    expect(parsed.records.length).toBe(3);
    expect(parsed.fields.some((f) => f.name === 'orderId' && f.type === 'long')).toBe(true);
    expect(parsed.records.some((r) => r.values.sku === 'EVT-HOME')).toBe(true);
  });

  it('parses JSON, Avsc, and Markdown', () => {
    const json = parseAvroText(AV_JSON_SAMPLE, 'events.json');
    expect(json.sourceKind).toBe('json');
    expect(json.fields.length).toBe(3);
    expect(json.records.length).toBe(1);

    const avsc = parseAvroText(AV_AVSC_SAMPLE, 'events.avsc');
    expect(avsc.sourceKind).toBe('avsc');
    expect(avsc.fields.length).toBe(4);
    expect(avsc.records.length).toBe(0);
    expect(avsc.warnings.some((w) => /schema-only/i.test(w))).toBe(true);

    const md = parseAvroText(AV_MARKDOWN_SAMPLE, 'events.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.fields.length).toBeGreaterThanOrEqual(3);
    expect(md.records.length).toBeGreaterThanOrEqual(1);
  });

  it('filters fields and records', () => {
    const parsed = parseAvroBytes(buildSampleAvroBytes(), 'events.avro');
    expect(filterAvFields(parsed.fields, 'field:sku').length).toBe(1);
    expect(filterAvFields(parsed.fields, 'type:double').length).toBe(1);
    expect(filterAvRecords(parsed.records, 'sku:EVT-P').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseAvroText('')).toThrow(/empty/i);
    expect(() => parseAvroText('hello world')).toThrow(/Not an Avro/i);
  });
});

describe('avro-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleAvFile();
    expect(file.name).toBe('clickstream.avro');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample avro', () => {
    const file = createSampleAvFile();
    const record = createAvFileRecord(file, buildSampleAvroBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.fields.length).toBe(4);
    expect(record.parsed?.records.length).toBe(3);
    expect(canExportAv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseAvroBytes(buildSampleAvroBytes(), 'events.avro');
    const csv = exportAvSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,nullable');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleAvFile();
    const { accepted, rejected } = filterValidAvFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'events.avro.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('disables export on soft-fail and null', () => {
    expect(canExportAv({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportAv(null)).toBe(false);
  });

  it('resolves suggestions for empty and error states', () => {
    expect(resolveAvSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveAvSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveAvSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
