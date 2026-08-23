import {
  GML_GRAPHML_SAMPLE,
  GML_JSON_SAMPLE,
  GML_MARKDOWN_SAMPLE,
  GML_NO_COMMUNITY_SAMPLE
} from '../constants/graphml-viewer-sample.data';
import { filterGmlEdges, filterGmlNodes, parseGraphmlText, relayoutGml } from './graphml-viewer-parse.utils';
import { canExportGml, createGmlFileRecord, createSampleGmlFile, exportGmlNodesCsv, filterValidGmlFiles } from './graphml-viewer.utils';

describe('graphml-viewer-parse.utils', () => {
  it('parses the shop GraphML sample', () => {
    const parsed = parseGraphmlText(GML_GRAPHML_SAMPLE, 'sample-shop.graphml');
    expect(parsed.directed).toBe(false);
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.edges.length).toBe(4);
    expect(parsed.communities.length).toBe(2);
    expect(parsed.nodes.some((n) => n.label === 'Customer' && n.community === 'shoppers')).toBe(true);
    expect(parsed.edges.some((e) => e.weight === 0.5)).toBe(true);
  });

  it('parses JSON, markdown fence, and infers communities', () => {
    const json = parseGraphmlText(GML_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(3);
    expect(json.edges.length).toBe(2);
    expect(json.communities.length).toBe(2);

    const md = parseGraphmlText(GML_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBe(2);
    expect(md.edges.length).toBe(1);

    const inferred = parseGraphmlText(GML_NO_COMMUNITY_SAMPLE, 'plain.graphml');
    expect(inferred.directed).toBe(true);
    expect(inferred.nodes.length).toBe(3);
    expect(inferred.communities.length).toBeGreaterThanOrEqual(2);
    expect(inferred.warnings.some((w) => /inferred/i.test(w))).toBe(true);
  });

  it('filters nodes and relayouts by community', () => {
    const parsed = parseGraphmlText(GML_GRAPHML_SAMPLE, 'shop.graphml');
    expect(filterGmlNodes(parsed.nodes, 'comm:shoppers').every((n) => n.community === 'shoppers')).toBe(true);
    expect(filterGmlEdges(parsed.edges, 'from:Customer').length).toBeGreaterThan(0);
    const relaid = relayoutGml(parsed, 'community');
    expect(relaid.nodes.length).toBe(4);
    const shoppers = relaid.nodes.filter((n) => n.community === 'shoppers');
    expect(shoppers.every((n) => n.x === shoppers[0].x)).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseGraphmlText('')).toThrow(/empty/i);
    expect(() => parseGraphmlText('hello world')).toThrow(/Not a GraphML/i);
  });
});

describe('graphml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGmlFile();
    expect(file.name).toBe('sample-shop.graphml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample GraphML', () => {
    const file = createSampleGmlFile();
    const record = createGmlFileRecord(file, new TextEncoder().encode(GML_GRAPHML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(4);
    expect(canExportGml(record)).toBe(true);
  });

  it('exports nodes csv', () => {
    const parsed = parseGraphmlText(GML_GRAPHML_SAMPLE, 'shop.graphml');
    const csv = exportGmlNodesCsv(parsed);
    expect(csv).toContain('index,id,label,community,rank');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleGmlFile();
    const { accepted, rejected } = filterValidGmlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.graphml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
