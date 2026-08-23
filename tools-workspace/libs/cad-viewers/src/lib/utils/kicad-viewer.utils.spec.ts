import {
  KC_ASCII_SAMPLE,
  KC_CSV_SAMPLE,
  KC_JSON_SAMPLE,
  KC_MARKDOWN_SAMPLE,
  KC_SEXPR_SAMPLE
} from '../constants/kicad-viewer-sample.data';
import {
  buildSampleKcBytes,
  filterKcBoardItems,
  filterKcLayers,
  filterKcNets,
  filterKcRows,
  filterKcSchItems,
  parseKcBytes,
  parseKcText
} from './kicad-viewer-parse.utils';
import {
  canExportKc,
  createKcFileRecord,
  createSampleKcFile,
  exportKcSchemaCsv,
  filterValidKcFiles
} from './kicad-viewer.utils';

describe('kicad-viewer-parse.utils', () => {
  it('parses the Nucleo hat KiCad dump sample', () => {
    const parsed = parseKcBytes(buildSampleKcBytes(), 'nucleo-hat.kicad_pcb');
    expect(parsed.sourceKind).toBe('kicad');
    expect(parsed.name).toBe('Nucleo Hat');
    expect(parsed.kicadVer).toBe('8.0');
    expect(parsed.layers.some((l) => l.name === 'F.Cu' && l.function === 'copper')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'silk')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'GND' && n.netClass === 'ground')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'SPI')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'track' && b.net === 'GND')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'via')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'pad' && b.net === '3V3')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'footprint' && b.name === 'U1')).toBe(true);
    expect(parsed.boardItems.some((b) => b.type === 'text' && b.text === 'NUCLEO-HAT')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'symbol' && s.name === 'U1')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'wire')).toBe(true);
    expect(parsed.schItems.some((s) => s.type === 'label' && s.text === 'SPI')).toBe(true);
  });

  it('parses s-expr, JSON, CSV, and Markdown dumps', () => {
    const sexpr = parseKcText(KC_SEXPR_SAMPLE, 'shop.kicad_pcb');
    expect(sexpr.sourceKind).toBe('kicad');
    expect(sexpr.boardItems.some((b) => b.type === 'track')).toBe(true);
    expect(sexpr.boardItems.some((b) => b.type === 'via')).toBe(true);
    expect(sexpr.boardItems.some((b) => b.type === 'text' && b.text === 'NUCLEO-HAT')).toBe(true);
    expect(sexpr.nets.some((n) => n.name === 'GND')).toBe(true);

    const json = parseKcText(KC_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'F.Cu')).toBe(true);
    expect(json.boardItems.some((b) => b.name === 'via1' && b.type === 'via')).toBe(true);
    expect(json.schItems.some((s) => s.name === 'U1' && s.type === 'symbol')).toBe(true);

    const csv = parseKcText(KC_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.boardItems.some((b) => b.type === 'track')).toBe(true);
    expect(csv.schItems.some((s) => s.type === 'symbol')).toBe(true);

    const md = parseKcText(KC_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nets.some((n) => n.name === 'GND')).toBe(true);

    const ascii = parseKcText(KC_ASCII_SAMPLE, 'shop.kicad_pcb');
    expect(ascii.sourceKind).toBe('kicad');
    expect(ascii.boardItems.some((b) => b.type === 'zone' && b.points.length >= 4)).toBe(true);
  });

  it('filters stack, nets, board, schematic, and rows', () => {
    const parsed = parseKcBytes(buildSampleKcBytes(), 'nucleo-hat.kicad_pcb');
    expect(filterKcLayers(parsed.layers, 'layer:F.Cu').length).toBe(1);
    expect(filterKcNets(parsed.nets, 'net:GND').length).toBe(1);
    expect(filterKcBoardItems(parsed.boardItems, 'type:via').length).toBe(1);
    expect(filterKcSchItems(parsed.schItems, 'sch:U1').length).toBeGreaterThanOrEqual(1);
    expect(filterKcRows(parsed.rows, 'net:3V3').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseKcText('')).toThrow(/empty/i);
    expect(() => parseKcText('hello world')).toThrow(/Not a KiCad/i);
    expect(() => parseKcBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.kicad_pcb')).toThrow(/compress/i);
  });
});

describe('kicad-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleKcFile();
    expect(file.name).toBe('nucleo-hat.kicad_pcb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample KiCad dump', () => {
    const file = createSampleKcFile();
    const record = createKcFileRecord(file, buildSampleKcBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'copper')).toBe(true);
    expect(record.parsed?.schItems.some((s) => s.type === 'symbol')).toBe(true);
    expect(canExportKc(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseKcBytes(buildSampleKcBytes(), 'nucleo-hat.kicad_pcb');
    const csv = exportKcSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,net,x');
    expect(csv).toContain('GND');
    expect(csv).toContain('schematic');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.nets.length + parsed.boardItems.length + parsed.schItems.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleKcFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidKcFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.kicad_pcb.gz', { lastModified: 2 }),
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

describe('canExportKc guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportKc({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportKc(null)).toBe(false);
  });
});
