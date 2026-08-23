import { GENBANK_SAMPLE } from '../constants/genbank-sample.data';
import { parseGenbankLocation, parseGenbankText } from './genbank-parse.utils';
import {
  canExportGenbank,
  createGenbankFileRecord,
  createSampleGenbankFile,
  filterGenbankFeatures,
  filterValidGenbankFiles
} from './genbank-viewer.utils';

describe('genbank-parse.utils', () => {
  it('parses the sample GenBank record', () => {
    const parsed = parseGenbankText(GENBANK_SAMPLE);
    expect(parsed.records.length).toBe(1);
    const record = parsed.records[0];
    expect(record.locus).toBe('ETH001');
    expect(record.accession).toBe('ETH001');
    expect(record.sequence.length).toBe(120);
    expect(record.molType.toUpperCase()).toBe('DNA');
    expect(record.features.length).toBeGreaterThanOrEqual(4);
    expect(record.features.some((f) => f.type === 'CDS' && f.gene === 'adhS')).toBe(true);
    expect(record.features.some((f) => f.complement)).toBe(true);
  });

  it('parses complement and join locations', () => {
    const loc = parseGenbankLocation('complement(join(10..20,30..40))');
    expect(loc.complement).toBe(true);
    expect(loc.spans.length).toBe(2);
    expect(loc.spans[0].start).toBe(10);
    expect(loc.spans[1].end).toBe(40);
  });
});

describe('genbank-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGenbankFile();
    expect(file.name).toBe('sample-adh.gb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleGenbankFile();
    const bytes = new TextEncoder().encode(GENBANK_SAMPLE);
    const record = createGenbankFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.records[0].features.length).toBeGreaterThan(0);
    expect(canExportGenbank(record)).toBe(true);
  });

  it('filters features by type and query', () => {
    const parsed = parseGenbankText(GENBANK_SAMPLE);
    const features = parsed.records[0].features;
    expect(filterGenbankFeatures(features, 'adh', null).length).toBeGreaterThan(0);
    expect(filterGenbankFeatures(features, '', 'CDS').every((f) => f.type === 'CDS')).toBe(true);
  });

  it('rejects unsupported and gzip files', () => {
    const sample = createSampleGenbankFile();
    const { accepted, rejected } = filterValidGenbankFiles([
      sample,
      new File(['x'], 'reads.fastq', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'genome.gbk.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('.gz'))).toBe(true);
  });
});
