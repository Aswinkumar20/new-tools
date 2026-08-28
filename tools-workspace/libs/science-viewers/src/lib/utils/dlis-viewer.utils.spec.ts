import { buildSampleDlisBytes } from './dlis-build.utils';
import { parseDlisBytes } from './dlis-parse.utils';
import {
  canExportDlis,
  createDlisFileRecord,
  createSampleDlisFile,
  exportDlisChannelsCsv,
  exportDlisFrameCsv,
  filterDlisChannels,
  filterValidDlisFiles,
  resolveDlisSuggestion
} from './dlis-viewer.utils';

describe('dlis-parse.utils', () => {
  it('parses the sample DLIS storage unit and frame', () => {
    const parsed = parseDlisBytes(buildSampleDlisBytes());
    expect(parsed.sul?.version).toMatch(/^V1/i);
    expect(parsed.sul?.structure.toUpperCase()).toBe('RECORD');
    expect(parsed.well).toContain('SAMPLE-1');
    expect(parsed.company).toContain('EasyToolHub');
    expect(parsed.channels.map((c) => c.mnemonic)).toEqual(['DEPT', 'GR', 'RHOB', 'NPHI', 'DT']);
    expect(parsed.records.length).toBeGreaterThanOrEqual(5);
    expect(parsed.depth[0]).toBeCloseTo(100);
    expect(parsed.depth[parsed.depth.length - 1]).toBeCloseTo(140);
    expect(parsed.curves.map((c) => c.mnemonic)).toEqual(['GR', 'RHOB', 'NPHI', 'DT']);
    expect(parsed.curves[0].values.length).toBe(parsed.depth.length);
  });

  it('rejects files without a storage unit label', () => {
    expect(() => parseDlisBytes(new Uint8Array([1, 2, 3, 4]))).toThrow(/SUL|storage unit/i);
  });
});

describe('dlis-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDlisFile();
    expect(file.name).toBe('sample-well.dlis');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleDlisFile();
    const record = createDlisFileRecord(file, buildSampleDlisBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.curves.length).toBe(4);
    expect(canExportDlis(record)).toBe(true);
  });

  it('filters channels and exports csv', () => {
    const parsed = parseDlisBytes(buildSampleDlisBytes());
    expect(filterDlisChannels(parsed.channels, 'gamma').some((c) => c.mnemonic === 'GR')).toBe(true);
    const channelsCsv = exportDlisChannelsCsv(parsed);
    expect(channelsCsv).toContain('mnemonic,unit,longName,representation');
    expect(channelsCsv).toContain('GR,');
    const frameCsv = exportDlisFrameCsv(parsed, ['GR', 'RHOB']);
    expect(frameCsv.split('\n')[0]).toBe('DEPT,GR,RHOB');
    expect(frameCsv.split('\n').length).toBe(parsed.depth.length + 1);
  });

  it('rejects unsupported gzip and non-dlis files', () => {
    const sample = createSampleDlisFile();
    const { accepted, rejected } = filterValidDlisFiles([
      sample,
      new File(['x'], 'well.las', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'well.dlis.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('canExportDlis is false for null', () => {
    expect(canExportDlis(null)).toBe(false);
  });

  it('soft-fails unparseable bytes and disables export', () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bad.dlis', { lastModified: 3 });
    const record = createDlisFileRecord(file, new Uint8Array([1, 2, 3, 4]));
    expect(record.softFail).toBe(true);
    expect(canExportDlis(record)).toBe(false);
    expect(record.warnings.length).toBeGreaterThan(0);
  });

  it('resolveDlisSuggestion returns upload when empty', () => {
    expect(resolveDlisSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-dlis');
  });

  it('resolveDlisSuggestion returns sample after error', () => {
    expect(resolveDlisSuggestion({ hasFiles: false, hasError: true })?.id).toBe('try-sample');
    expect(resolveDlisSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
