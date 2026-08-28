import {
  ARCH_JSON_SAMPLE,
  ARCH_MARKDOWN_SAMPLE,
  ARCH_MERMAID_SAMPLE,
  ARCH_PUML_SAMPLE,
  ARCH_XML_SAMPLE
} from '../constants/architecture-diagram-viewer-sample.data';
import { filterArchBoxes, filterArchConnectors, parseArchitectureText } from './architecture-diagram-viewer-parse.utils';
import {
  canExportArch,
  createArchFileRecord,
  createSampleArchFile,
  exportArchBoxesCsv,
  filterValidArchFiles,
  resolveArchSuggestion
} from './architecture-diagram-viewer.utils';

describe('architecture-diagram-viewer-parse.utils', () => {
  it('parses the shop architecture sample', () => {
    const parsed = parseArchitectureText(ARCH_PUML_SAMPLE, 'sample-shop-arch.puml');
    expect(parsed.title).toBe('Shop architecture');
    expect(parsed.boxes.length).toBe(4);
    expect(parsed.connectors.length).toBe(3);
    expect(parsed.boxes.some((b) => b.kind === 'database' && b.name === 'Orders')).toBe(true);
    expect(parsed.boxes.some((b) => b.kind === 'cloud' && b.id === 'Pay')).toBe(true);
    expect(parsed.connectors.some((c) => c.style === 'depend' && c.label === 'Charge')).toBe(true);
    expect(parsed.connectors.some((c) => c.style === 'data' && c.label === 'SQL')).toBe(true);
  });

  it('parses mermaid, markdown fence, JSON, and XML', () => {
    const mermaid = parseArchitectureText(ARCH_MERMAID_SAMPLE, 'shop.mmd');
    expect(mermaid.sourceKind).toBe('mermaid');
    expect(mermaid.boxes.length).toBe(4);
    expect(mermaid.connectors.length).toBe(3);
    expect(mermaid.boxes.some((b) => b.kind === 'database')).toBe(true);

    const md = parseArchitectureText(ARCH_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.boxes.length).toBe(3);
    expect(md.connectors.length).toBe(2);

    const json = parseArchitectureText(ARCH_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.boxes.length).toBe(3);
    expect(json.connectors.length).toBe(2);

    const xml = parseArchitectureText(ARCH_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.boxes.length).toBe(2);
    expect(xml.connectors.length).toBe(2);
  });

  it('filters boxes and connectors', () => {
    const parsed = parseArchitectureText(ARCH_PUML_SAMPLE, 'shop.puml');
    expect(filterArchBoxes(parsed.boxes, 'kind:database').every((b) => b.kind === 'database')).toBe(true);
    expect(filterArchConnectors(parsed.connectors, 'rel:HTTPS').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseArchitectureText('')).toThrow(/empty/i);
    expect(() => parseArchitectureText('hello world')).toThrow(/Not an architecture/i);
  });
});

describe('architecture-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleArchFile();
    expect(file.name).toBe('sample-shop-arch.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample architecture', () => {
    const file = createSampleArchFile();
    const record = createArchFileRecord(file, new TextEncoder().encode(ARCH_PUML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.boxes.length).toBe(4);
    expect(canExportArch(record)).toBe(true);
  });

  it('exports boxes csv', () => {
    const parsed = parseArchitectureText(ARCH_PUML_SAMPLE, 'shop.puml');
    const csv = exportArchBoxesCsv(parsed);
    expect(csv).toContain('index,id,name,kind,stereotype');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleArchFile();
    const { accepted, rejected } = filterValidArchFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.puml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveArchSuggestion covers empty and error states', () => {
    expect(resolveArchSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveArchSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveArchSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createArchFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportArch(record)).toBe(false);
    expect(canExportArch(null)).toBe(false);
  });
});
