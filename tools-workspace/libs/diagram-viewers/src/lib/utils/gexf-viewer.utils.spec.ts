import {
  GXF_GEXF_SAMPLE,
  GXF_JSON_SAMPLE,
  GXF_MARKDOWN_SAMPLE,
  GXF_NO_COMMUNITY_SAMPLE
} from '../constants/gexf-viewer-sample.data';
import { filterGxfEdges, filterGxfNodes, isGxfActive, parseGexfText } from './gexf-viewer-parse.utils';
import { canExportGxf, createGxfFileRecord, createSampleGxfFile, exportGxfNodesCsv, filterValidGxfFiles } from './gexf-viewer.utils';

describe('gexf-viewer-parse.utils', () => {
  it('parses the shop GEXF sample', () => {
    const parsed = parseGexfText(GXF_GEXF_SAMPLE, 'sample-shop.gexf');
    expect(parsed.directed).toBe(true);
    expect(parsed.mode).toBe('dynamic');
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.edges.length).toBe(4);
    expect(parsed.communities.length).toBe(2);
    expect(parsed.timeMin).toBe(0);
    expect(parsed.timeMax).toBe(10);
    expect(parsed.nodes.some((n) => n.label === 'Customer' && n.community === 'shoppers')).toBe(true);
    expect(parsed.edges.some((e) => e.weight === 0.5)).toBe(true);
  });

  it('filters timeline slices and parses json/md/infer', () => {
    const parsed = parseGexfText(GXF_GEXF_SAMPLE, 'shop.gexf');
    expect(filterGxfNodes(parsed.nodes, '', '', 0).map((n) => n.label).sort()).toEqual(['Cart', 'Customer']);
    expect(filterGxfNodes(parsed.nodes, '', '', 9).every((n) => n.label !== 'Cart')).toBe(true);
    expect(filterGxfNodes(parsed.nodes, '', '', 9).length).toBe(3);
    expect(filterGxfEdges(parsed.edges, '', 0).length).toBe(1);
    expect(isGxfActive('2', '6', 2)).toBe(true);
    expect(isGxfActive('2', '6', 7)).toBe(false);

    const json = parseGexfText(GXF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(3);
    expect(json.edges.length).toBe(2);
    expect(json.communities.length).toBe(2);

    const md = parseGexfText(GXF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBe(2);
    expect(md.edges.length).toBe(1);

    const inferred = parseGexfText(GXF_NO_COMMUNITY_SAMPLE, 'plain.gexf');
    expect(inferred.directed).toBe(true);
    expect(inferred.nodes.length).toBe(3);
    expect(inferred.communities.length).toBeGreaterThanOrEqual(2);
    expect(inferred.warnings.some((w) => /inferred/i.test(w))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseGexfText('')).toThrow(/empty/i);
    expect(() => parseGexfText('hello world')).toThrow(/Not a GEXF/i);
  });
});

describe('gexf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGxfFile();
    expect(file.name).toBe('sample-shop.gexf');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample GEXF', () => {
    const file = createSampleGxfFile();
    const record = createGxfFileRecord(file, new TextEncoder().encode(GXF_GEXF_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(4);
    expect(canExportGxf(record)).toBe(true);
  });

  it('exports nodes csv', () => {
    const parsed = parseGexfText(GXF_GEXF_SAMPLE, 'shop.gexf');
    const csv = exportGxfNodesCsv(parsed);
    expect(csv).toContain('index,id,label,community,start,end');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleGxfFile();
    const { accepted, rejected } = filterValidGxfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.gexf.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
