import { PL_ASCII_SAMPLE, PL_CSV_SAMPLE, PL_JSON_SAMPLE, PL_MARKDOWN_SAMPLE } from '../constants/plt-plot-viewer-sample.data';
import {
  buildSamplePlBytes,
  filterPlCommands,
  filterPlPens,
  filterPlRows,
  parsePlBytes,
  parsePlText
} from './plt-plot-viewer-parse.utils';
import {
  canExportPl,
  createPlFileRecord,
  createSamplePlFile,
  exportPlSchemaCsv,
  filterValidPlFiles
} from './plt-plot-viewer.utils';

describe('plt-plot-viewer-parse.utils', () => {
  it('parses the title-block ASCII PLT sample', () => {
    const parsed = parsePlBytes(buildSamplePlBytes(), 'title-block.plt');
    expect(parsed.sourceKind).toBe('plt');
    expect(parsed.name).toBe('Title Block');
    expect(parsed.plotterVer).toBe('HPGL/2');
    expect(parsed.pens.some((p) => p.name === 'BORDER')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'polyline' && c.pen === 'BORDER')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'circle')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'text' && c.text === 'TITLE-BLOCK')).toBe(true);
    expect(parsed.units).toBe('m');
  });

  it('parses JSON, CSV, Markdown, and ASCII dumps', () => {
    const json = parsePlText(PL_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.pens.some((p) => p.name === 'BORDER')).toBe(true);
    expect(json.commands.some((c) => c.name === 'rev-bubble' && c.type === 'circle')).toBe(true);
    expect(json.commands.some((c) => c.name === 'rev-box' && c.type === 'polyline')).toBe(true);

    const csv = parsePlText(PL_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.commands.some((c) => c.type === 'line')).toBe(true);

    const md = parsePlText(PL_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.pens.some((p) => p.name === 'BORDER')).toBe(true);

    const ascii = parsePlText(PL_ASCII_SAMPLE, 'shop.plt');
    expect(ascii.sourceKind).toBe('plt');
    expect(ascii.commands.some((c) => c.type === 'polyline' && c.points.length >= 4)).toBe(true);
  });

  it('filters pens, commands, and rows', () => {
    const parsed = parsePlBytes(buildSamplePlBytes(), 'title-block.plt');
    expect(filterPlPens(parsed.pens, 'pen:BORDER').length).toBe(1);
    expect(filterPlCommands(parsed.commands, 'type:circle').length).toBe(1);
    expect(filterPlCommands(parsed.commands, 'type:polyline').length).toBeGreaterThanOrEqual(1);
    expect(filterPlRows(parsed.rows, 'type:text').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parsePlText('')).toThrow(/empty/i);
    expect(() => parsePlText('hello world')).toThrow(/Not a PLT/i);
    expect(() => parsePlBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.plt')).toThrow(/compress/i);
  });
});

describe('plt-plot-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePlFile();
    expect(file.name).toBe('title-block.plt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample PLT dump', () => {
    const file = createSamplePlFile();
    const record = createPlFileRecord(file, buildSamplePlBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.pens.some((p) => p.name === 'BORDER')).toBe(true);
    expect(record.parsed?.commands.some((c) => c.type === 'circle')).toBe(true);
    expect(record.parsed?.commands.some((c) => c.type === 'polyline')).toBe(true);
    expect(canExportPl(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePlBytes(buildSamplePlBytes(), 'title-block.plt');
    const csv = exportPlSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,pen,x,y');
    expect(csv).toContain('BORDER');
    expect(csv.split('\n').length).toBe(parsed.pens.length + parsed.commands.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSamplePlFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidPlFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.plt.gz', { lastModified: 2 }),
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

describe('canExportPl guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportPl({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportPl(null)).toBe(false);
  });
});
