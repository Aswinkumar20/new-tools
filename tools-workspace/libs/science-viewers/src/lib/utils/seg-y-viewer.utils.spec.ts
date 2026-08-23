import { buildSampleSegyBytes } from './segy-build.utils';
import { parseSegyBytes } from './segy-parse.utils';
import {
  canExportSegy,
  createSampleSegyFile,
  createSegyFileRecord,
  exportSegyAmplitudesCsv,
  exportSegyTracesCsv,
  filterSegyTraces,
  filterValidSegyFiles
} from './seg-y-viewer.utils';

describe('segy-parse.utils', () => {
  it('parses the sample SEG-Y line', () => {
    const parsed = parseSegyBytes(buildSampleSegyBytes());
    expect(parsed.textEncoding).toBe('ascii');
    expect(parsed.sampleFormat).toBe('ieee-f32');
    expect(parsed.formatCode).toBe(5);
    expect(parsed.littleEndian).toBe(false);
    expect(parsed.previewTraces).toBe(80);
    expect(parsed.samplesPerTrace).toBe(200);
    expect(parsed.dtUs).toBe(2000);
    expect(parsed.revision).toBe('1.0');
    expect(parsed.amplitudes.length).toBe(80 * 200);
    expect(parsed.rmsAmp).toBeGreaterThan(0);
    expect(parsed.traces[0].cdp).toBe(1);
  });

  it('rejects tiny files', () => {
    expect(() => parseSegyBytes(new Uint8Array(100))).toThrow(/3600|SEG-Y/i);
  });
});

describe('seg-y-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSegyFile();
    expect(file.name).toBe('sample-line.sgy');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleSegyFile();
    const record = createSegyFileRecord(file, buildSampleSegyBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.previewTraces).toBe(80);
    expect(canExportSegy(record)).toBe(true);
  });

  it('filters traces and exports csv', () => {
    const parsed = parseSegyBytes(buildSampleSegyBytes());
    expect(filterSegyTraces(parsed.traces, '10').some((t) => t.index === 9 || t.cdp === 10)).toBe(true);
    const tracesCsv = exportSegyTracesCsv(parsed.traces);
    expect(tracesCsv.split('\n')[0]).toContain('cdp');
    expect(tracesCsv.split('\n').length).toBe(parsed.traces.length + 1);
    const amps = exportSegyAmplitudesCsv(parsed, [0, 1], 10);
    expect(amps.startsWith('sample_ms,T1,T2')).toBe(true);
  });

  it('rejects unsupported gzip and non-segy files', () => {
    const sample = createSampleSegyFile();
    const { accepted, rejected } = filterValidSegyFiles([
      sample,
      new File(['x'], 'line.las', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'line.sgy.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
