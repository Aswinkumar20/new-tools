import {
  UML_CLASS_SAMPLE,
  UML_JSON_SAMPLE,
  UML_MERMAID_SEQUENCE_SAMPLE,
  UML_SEQUENCE_SAMPLE,
  UML_XMI_SAMPLE
} from '../constants/uml-viewer-sample.data';
import { filterUmlLinks, filterUmlNodes, parseUmlText } from './uml-viewer-parse.utils';
import { canExportUml, createSampleUmlFile, createUmlFileRecord, exportUmlClassifiersCsv, filterValidUmlFiles } from './uml-viewer.utils';

describe('uml-viewer-parse.utils', () => {
  it('parses the order class sample', () => {
    const parsed = parseUmlText(UML_CLASS_SAMPLE, 'sample-order-uml.puml');
    expect(parsed.kind).toBe('class');
    expect(parsed.title).toBe('Order domain');
    expect(parsed.nodes.length).toBe(3);
    expect(parsed.links.length).toBe(2);
    expect(parsed.nodes.some((n) => n.kind === 'interface' && n.name === 'Payable')).toBe(true);
    expect(parsed.links.some((l) => l.style === 'realize')).toBe(true);
    expect(parsed.links.some((l) => l.label === 'places')).toBe(true);
  });

  it('parses PlantUML sequence, mermaid sequence, XMI, and JSON', () => {
    const seq = parseUmlText(UML_SEQUENCE_SAMPLE, 'checkout.puml');
    expect(seq.kind).toBe('sequence');
    expect(seq.nodes.length).toBe(2);
    expect(seq.links.length).toBe(2);
    expect(seq.nodes.some((n) => n.kind === 'actor')).toBe(true);
    expect(seq.links.every((l) => l.linkKind === 'message')).toBe(true);

    const mermaid = parseUmlText(UML_MERMAID_SEQUENCE_SAMPLE, 'pay.md');
    expect(mermaid.kind).toBe('sequence');
    expect(mermaid.nodes.length).toBe(2);
    expect(mermaid.links.length).toBe(2);
    expect(mermaid.nodes.find((n) => n.id === 'U')?.name).toBe('User');

    const xmi = parseUmlText(UML_XMI_SAMPLE, 'shop.xmi');
    expect(xmi.sourceKind).toBe('xmi');
    expect(xmi.nodes.length).toBe(2);
    expect(xmi.links.length).toBe(1);
    expect(xmi.links[0].label).toBe('places');

    const json = parseUmlText(UML_JSON_SAMPLE, 'checkout.json');
    expect(json.sourceKind).toBe('json');
    expect(json.kind).toBe('sequence');
    expect(json.links.length).toBe(2);
  });

  it('filters class vs sequence nodes', () => {
    const parsed = parseUmlText(UML_CLASS_SAMPLE, 'order.puml');
    expect(filterUmlNodes(parsed.nodes, 'kind:class').every((n) => n.kind === 'class')).toBe(true);
    expect(filterUmlNodes(parsed.nodes, '', 'class').length).toBe(3);
    expect(filterUmlNodes(parsed.nodes, '', 'sequence').length).toBe(0);
    expect(filterUmlLinks(parsed.links, 'label:places').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseUmlText('')).toThrow(/empty/i);
    expect(() => parseUmlText('hello world')).toThrow(/Not a UML/i);
  });
});

describe('uml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleUmlFile();
    expect(file.name).toBe('sample-order-uml.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample classes', () => {
    const file = createSampleUmlFile();
    const record = createUmlFileRecord(file, new TextEncoder().encode(UML_CLASS_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(3);
    expect(canExportUml(record)).toBe(true);
  });

  it('exports classifiers csv', () => {
    const parsed = parseUmlText(UML_CLASS_SAMPLE, 'order.puml');
    const csv = exportUmlClassifiersCsv(parsed);
    expect(csv).toContain('index,id,name,kind,members');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleUmlFile();
    const { accepted, rejected } = filterValidUmlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'order.uml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
