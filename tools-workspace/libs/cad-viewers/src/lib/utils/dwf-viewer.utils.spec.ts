import { WF_CSV_SAMPLE, WF_JSON_SAMPLE, WF_MARKDOWN_SAMPLE } from '../constants/dwf-viewer-sample.data';
import {
  buildSampleWfBytes,
  filterWfEntities,
  filterWfLayers,
  filterWfRows,
  filterWfSheets,
  parseWfBytes,
  parseWfText
} from './dwf-viewer-parse.utils';
import {
  canExportWf,
  createSampleWfFile,
  createWfFileRecord,
  exportWfSchemaCsv,
  filterValidWfFiles,
  resolveWfSuggestion
} from './dwf-viewer.utils';

describe('dwf-viewer-parse.utils', () => {
  it('parses the permit WF01 sample', () => {
    const parsed = parseWfBytes(buildSampleWfBytes(), 'permit-set.dwf');
    expect(parsed.sourceKind).toBe('dwf');
    expect(parsed.name).toBe('Permit Set');
    expect(parsed.sheets.some((s) => s.name === 'Cover')).toBe(true);
    expect(parsed.sheets.some((s) => s.name === 'A1')).toBe(true);
    expect(parsed.layers.some((l) => l.name === 'PLAN')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'line' && e.layer === 'PLAN' && e.sheet === 'A1')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'markup' && e.name === 'review-note')).toBe(true);
    expect(parsed.entities.some((e) => e.sheet === 'Cover' && e.text === 'PERMIT SET')).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseWfText(WF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.sheets.length).toBe(2);
    expect(json.entities.some((e) => e.type === 'circle' && e.name === 'column')).toBe(true);

    const csv = parseWfText(WF_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.sheets.some((s) => s.name === 'A1')).toBe(true);

    const md = parseWfText(WF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'PLAN')).toBe(true);
  });

  it('filters sheets, layers, entities, and rows', () => {
    const parsed = parseWfBytes(buildSampleWfBytes(), 'permit-set.dwf');
    expect(filterWfSheets(parsed.sheets, 'sheet:A1').length).toBe(1);
    expect(filterWfLayers(parsed.layers, 'layer:PLAN').length).toBe(1);
    expect(filterWfEntities(parsed.entities, 'type:markup').length).toBe(1);
    expect(filterWfRows(parsed.rows, 'sheet:Cover').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, unknown text, classic DWF, and DWFX zip', () => {
    expect(() => parseWfText('')).toThrow(/empty/i);
    expect(() => parseWfText('hello world')).toThrow(/Not a DWF/i);
    expect(() => parseWfBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.dwf')).toThrow(/compress/i);
    expect(() => parseWfBytes(new TextEncoder().encode('(DWF V06.00.00'), 'classic.dwf')).toThrow(/W2D|Classic/i);
    expect(() => parseWfBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'pub.dwfx')).toThrow(/DWFX/i);
  });
});

describe('dwf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleWfFile();
    expect(file.name).toBe('permit-set.dwf');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample DWF dump', () => {
    const file = createSampleWfFile();
    const record = createWfFileRecord(file, buildSampleWfBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.sheets.some((s) => s.name === 'A1')).toBe(true);
    expect(canExportWf(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseWfBytes(buildSampleWfBytes(), 'permit-set.dwf');
    const csv = exportWfSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,sheet,layer,value');
    expect(csv).toContain('Cover');
    expect(csv.split('\n').length).toBe(parsed.sheets.length + parsed.layers.length + parsed.entities.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleWfFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidWfFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.dwf.gz', { lastModified: 2 }),
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

describe('canExportWf guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportWf({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportWf(null)).toBe(false);
  });
});

describe('resolveWfSuggestion', () => {
  it('returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolveWfSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveWfSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveWfSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
