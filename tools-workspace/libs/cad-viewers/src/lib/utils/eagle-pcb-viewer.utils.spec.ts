import {
  EG_ASCII_SAMPLE,
  EG_CSV_SAMPLE,
  EG_JSON_SAMPLE,
  EG_MARKDOWN_SAMPLE,
  EG_XML_SAMPLE
} from '../constants/eagle-pcb-viewer-sample.data';
import {
  buildSampleEgBytes,
  filterEgBoardItems,
  filterEgLayers,
  filterEgNets,
  filterEgRows,
  filterEgSchItems,
  parseEgBytes,
  parseEgText
} from './eagle-pcb-viewer-parse.utils';
import {
  canExportEg,
  createEgFileRecord,
  createSampleEgFile,
  exportEgSchemaCsv,
  filterValidEgFiles,
  resolveEgSuggestion
} from './eagle-pcb-viewer.utils';

describe('eagle-pcb-viewer-parse.utils', () => {
  it('parses the Arduino shield Eagle dump sample', () => {
    const parsed = parseEgBytes(buildSampleEgBytes(), 'arduino-shield.brd');
    expect(parsed.sourceKind).toBe('eagle');
    expect(parsed.name).toBe('Arduino Shield');
    expect(parsed.eagleVer).toBe('9.6.2');
    expect(parsed.layers.some((l) => l.name === '1' && l.function === 'copper')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'silk')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'GND' && n.netClass === 'ground')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'A0')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'wire' && b.net === 'GND')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'via')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'pad' && b.net === '5V')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'text' && b.text === 'ARDUINO-SHIELD')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'instance' && s.name === 'U1')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'schwire')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'label' && s.text === 'A0')).toBe(true);
  });

  it('parses XML, JSON, CSV, and Markdown dumps', () => {
    const xml = parseEgText(EG_XML_SAMPLE, 'shop.brd');
    expect(xml.sourceKind).toBe('eagle');
    expect(xml.eagleVer).toBe('9.6.2');
    expect(xml.boardItems.some((b) => b.type === 'wire')).toBe(true);
    expect(xml.boardItems.some((b) => b.type === 'via')).toBe(true);
    expect(xml.boardItems.some((b) => b.type === 'text' && b.text === 'ARDUINO-SHIELD')).toBe(true);
    expect(xml.schItems.some((s) => s.type === 'instance' && s.name === 'U1')).toBe(true);
    expect(xml.schItems.some((s) => s.type === 'label')).toBe(true);
    expect(xml.nets.some((n) => n.name === 'GND')).toBe(true);

    const json = parseEgText(EG_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === '1')).toBe(true);
    expect(json.boardItems.some((b) => b.name === 'via1' && b.type === 'via')).toBe(true);
    expect(json.schItems.some((s) => s.name === 'U1' && s.type === 'instance')).toBe(true);

    const csv = parseEgText(EG_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.boardItems.some((b) => b.type === 'wire')).toBe(true);
    expect(csv.schItems.some((s) => s.type === 'instance')).toBe(true);

    const md = parseEgText(EG_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nets.some((n) => n.name === 'GND')).toBe(true);

    const ascii = parseEgText(EG_ASCII_SAMPLE, 'shop.brd');
    expect(ascii.sourceKind).toBe('eagle');
    expect(ascii.boardItems.some((b) => b.type === 'rect' && b.points.length >= 4)).toBe(true);
  });

  it('filters stack, nets, board, schematic, and rows', () => {
    const parsed = parseEgBytes(buildSampleEgBytes(), 'arduino-shield.brd');
    expect(filterEgLayers(parsed.layers, 'layer:16').length).toBe(1);
    expect(filterEgNets(parsed.nets, 'net:GND').length).toBe(1);
    expect(filterEgBoardItems(parsed.boardItems, 'type:via').length).toBe(1);
    expect(filterEgSchItems(parsed.schItems, 'inst:U1').length).toBeGreaterThanOrEqual(1);
    expect(filterEgRows(parsed.rows, 'net:5V').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseEgText('')).toThrow(/empty/i);
    expect(() => parseEgText('hello world')).toThrow(/Not an Eagle/i);
    expect(() => parseEgBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.brd')).toThrow(/compress/i);
  });
});

describe('eagle-pcb-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleEgFile();
    expect(file.name).toBe('arduino-shield.brd');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Eagle dump', () => {
    const file = createSampleEgFile();
    const record = createEgFileRecord(file, buildSampleEgBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'copper')).toBe(true);
    expect(record.parsed?.schItems.some((s) => s.type === 'instance')).toBe(true);
    expect(canExportEg(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseEgBytes(buildSampleEgBytes(), 'arduino-shield.brd');
    const csv = exportEgSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,net,x');
    expect(csv).toContain('GND');
    expect(csv).toContain('schematic');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.nets.length + parsed.boardItems.length + parsed.schItems.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleEgFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidEgFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.brd.gz', { lastModified: 2 }),
      empty,
      huge
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
    expect(rejected.some((item) => /empty/i.test(item.reason))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('too large'))).toBe(true);
  });
});

describe('canExportEg guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportEg({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportEg(null)).toBe(false);
  });
});

describe('resolveEgSuggestion', () => {
  it('returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolveEgSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveEgSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveEgSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
