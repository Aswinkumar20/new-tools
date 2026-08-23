import { PB_ASCII_SAMPLE, PB_CSV_SAMPLE, PB_JSON_SAMPLE, PB_MARKDOWN_SAMPLE } from '../constants/pcb-layout-viewer-sample.data';
import {
  buildSamplePbBytes,
  filterPbLayers,
  filterPbNets,
  filterPbRows,
  filterPbTraces,
  parsePbBytes,
  parsePbText
} from './pcb-layout-viewer-parse.utils';
import {
  canExportPb,
  createPbFileRecord,
  createSamplePbFile,
  exportPbSchemaCsv,
  filterValidPbFiles
} from './pcb-layout-viewer.utils';

describe('pcb-layout-viewer-parse.utils', () => {
  it('parses the sensor board PCB dump sample', () => {
    const parsed = parsePbBytes(buildSamplePbBytes(), 'sensor-board.pcb');
    expect(parsed.sourceKind).toBe('pcb');
    expect(parsed.name).toBe('Sensor Board');
    expect(parsed.boardVer).toBe('v1');
    expect(parsed.layers.some((l) => l.name === 'TOP_COPPER' && l.function === 'copper')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'GND' && n.netClass === 'ground')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'SDA')).toBe(true);
    expect(parsed.traces.some((t) => t.type === 'track' && t.net === 'GND')).toBe(true);
    expect(parsed.traces.some((t) => t.type === 'via')).toBe(true);
    expect(parsed.traces.some((t) => t.type === 'pad' && t.net === 'VCC')).toBe(true);
    expect(parsed.traces.some((t) => t.type === 'text' && t.text === 'SENSOR-BOARD')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII dumps', () => {
    const json = parsePbText(PB_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'TOP_COPPER')).toBe(true);
    expect(json.nets.some((n) => n.name === 'VCC' && n.netClass === 'power')).toBe(true);
    expect(json.traces.some((t) => t.name === 'via1' && t.type === 'via')).toBe(true);
    expect(json.traces.some((t) => t.name === 'counter' && t.type === 'zone')).toBe(true);

    const csv = parsePbText(PB_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.traces.some((t) => t.type === 'track')).toBe(true);

    const md = parsePbText(PB_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nets.some((n) => n.name === 'GND')).toBe(true);

    const ascii = parsePbText(PB_ASCII_SAMPLE, 'shop.pcb');
    expect(ascii.sourceKind).toBe('pcb');
    expect(ascii.traces.some((t) => t.type === 'zone' && t.points.length >= 4)).toBe(true);
  });

  it('filters stack, nets, traces, and rows', () => {
    const parsed = parsePbBytes(buildSamplePbBytes(), 'sensor-board.pcb');
    expect(filterPbLayers(parsed.layers, 'layer:TOP_COPPER').length).toBe(1);
    expect(filterPbNets(parsed.nets, 'net:GND').length).toBe(1);
    expect(filterPbTraces(parsed.traces, 'type:via').length).toBe(1);
    expect(filterPbRows(parsed.rows, 'net:VCC').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parsePbText('')).toThrow(/empty/i);
    expect(() => parsePbText('hello world')).toThrow(/Not a PCB/i);
    expect(() => parsePbBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.pcb')).toThrow(/compress/i);
  });
});

describe('pcb-layout-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePbFile();
    expect(file.name).toBe('sensor-board.pcb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample PCB dump', () => {
    const file = createSamplePbFile();
    const record = createPbFileRecord(file, buildSamplePbBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'copper')).toBe(true);
    expect(record.parsed?.nets.some((n) => n.name === 'GND')).toBe(true);
    expect(record.parsed?.traces.some((t) => t.type === 'via')).toBe(true);
    expect(canExportPb(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePbBytes(buildSamplePbBytes(), 'sensor-board.pcb');
    const csv = exportPbSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,net,x');
    expect(csv).toContain('GND');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.nets.length + parsed.traces.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSamplePbFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidPbFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.pcb.gz', { lastModified: 2 }),
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

describe('canExportPb guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportPb({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportPb(null)).toBe(false);
  });
});
