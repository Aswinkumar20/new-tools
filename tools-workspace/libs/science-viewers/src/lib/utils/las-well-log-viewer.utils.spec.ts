import { LAS_SAMPLE } from '../constants/las-sample.data';
import { parseLasText } from './las-parse.utils';
import {
  buildCurveMetadata,
  buildLasMetadataRows,
  canExportLas,
  createLasFileRecord,
  createSampleLasFile,
  exportLasCurvesCsv,
  exportLasSubset,
  exportLasSummaryJson,
  filterLasCurves,
  filterValidLasFiles,
  resolveLasSuggestion
} from './las-well-log-viewer.utils';

describe('las-parse.utils', () => {
  it('parses the sample CWLS LAS well log', () => {
    const parsed = parseLasText(LAS_SAMPLE);
    expect(parsed.version).toContain('2.0');
    expect(parsed.wrap).toBe(false);
    expect(parsed.nullValue).toBeCloseTo(-999.25);
    expect(parsed.depthUnit).toBe('M');
    expect(parsed.depth[0]).toBeCloseTo(100);
    expect(parsed.depth[parsed.depth.length - 1]).toBeCloseTo(140);
    expect(parsed.curves.map((c) => c.mnemonic)).toEqual(['GR', 'RHOB', 'NPHI', 'DT']);
    expect(parsed.curves.every((c) => c.values.length === parsed.depth.length)).toBe(true);
    expect(parsed.well.some((r) => r.mnemonic === 'WELL' && r.value.includes('SAMPLE-1'))).toBe(true);
  });

  it('warns and flattens WRAP=YES rows', () => {
    const wrapped = LAS_SAMPLE.replace(/WRAP\.\s+NO/, 'WRAP.                          YES').replace(
      /100\.00\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+/,
      (row) => `${row.trim()}\n   extra`
    );
    const parsed = parseLasText(wrapped);
    expect(parsed.wrap).toBe(true);
    expect(parsed.warnings.some((w) => /WRAP/i.test(w) || /Trailing/i.test(w))).toBe(true);
  });

  it('rejects files without ASCII data', () => {
    expect(() => parseLasText('~V\nVERS. 2.0 : x\n~W\nWELL. A : well\n')).toThrow(/ASCII|CURVE/i);
  });
});

describe('las-well-log-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleLasFile();
    expect(file.name).toBe('sample-well.las');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleLasFile();
    const bytes = new TextEncoder().encode(LAS_SAMPLE);
    const record = createLasFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.curves.length).toBe(4);
    expect(canExportLas(record)).toBe(true);
  });

  it('filters curves by mnemonic and description', () => {
    const parsed = parseLasText(LAS_SAMPLE);
    expect(filterLasCurves(parsed.curves, 'gr').map((c) => c.mnemonic)).toEqual(['GR']);
    expect(filterLasCurves(parsed.curves, 'neutron').some((c) => c.mnemonic === 'NPHI')).toBe(true);
  });

  it('exports curves csv and depth subset las', () => {
    const parsed = parseLasText(LAS_SAMPLE);
    const csv = exportLasCurvesCsv(parsed, ['GR', 'RHOB']);
    expect(csv.split('\n')[0]).toBe('DEPT,GR,RHOB');
    expect(csv.split('\n').length).toBe(parsed.depth.length + 1);
    const subset = exportLasSubset(parsed, ['GR'], 118, 126);
    expect(subset).toContain('~A');
    expect(subset).toContain('GR.');
    expect(subset.split('\n').filter((l) => /^\s*\d/.test(l)).length).toBeGreaterThan(5);
  });

  it('rejects unsupported gzip and non-las files', () => {
    const sample = createSampleLasFile();
    const { accepted, rejected } = filterValidLasFiles([
      sample,
      new File(['x'], 'well.dlis', { type: 'application/octet-stream', lastModified: 1 }),
      new File(['x'], 'well.las.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz'))).toBe(true);
  });

  it('soft-fails unparseable text and disables export', () => {
    const file = new File(['hello world'], 'bad.las', { lastModified: 3 });
    const record = createLasFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportLas(record)).toBe(false);
  });

  it('builds metadata and summary export', () => {
    const file = createSampleLasFile();
    const record = createLasFileRecord(file, new TextEncoder().encode(LAS_SAMPLE));
    expect(buildLasMetadataRows(record.parsed!).some((r) => r.key === 'Curves')).toBe(true);
    expect(buildCurveMetadata(record.parsed!.curves[0]).some((r) => r.key === 'Mnemonic')).toBe(true);
    expect(exportLasSummaryJson(record)).toContain('sample-well.las');
  });

  it('resolves upload and sample suggestions', () => {
    expect(resolveLasSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-las');
    expect(resolveLasSuggestion({ hasFiles: false, hasError: true })?.id).toBe('try-sample');
    expect(resolveLasSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
