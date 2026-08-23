import { FASTQ_SAMPLE } from '../constants/fastq-sample.data';
import { parseFastqText } from './fastq-parse.utils';
import {
  canExportFastq,
  createFastqFileRecord,
  createSampleFastqFile,
  filterFastqReads,
  filterValidFastqFiles
} from './fastq-viewer.utils';

describe('fastq-parse.utils', () => {
  it('parses the sample FASTQ as Phred+33', () => {
    const parsed = parseFastqText(FASTQ_SAMPLE);
    expect(parsed.reads.length).toBe(6);
    expect(parsed.encoding).toBe('phred33');
    expect(parsed.reads[0].length).toBe(40);
    expect(parsed.reads[0].scores.length).toBe(40);
    expect(parsed.reads[0].meanQ).toBeGreaterThan(20);
    expect(parsed.perPositionMeanQ.length).toBe(40);
    expect(parsed.qualityHistogram.some((n) => n > 0)).toBe(true);
  });

  it('warns on sequence/quality length mismatch', () => {
    const parsed = parseFastqText('@bad\nACGT\n+\nIII\n');
    expect(parsed.reads[0].sequence).toBe('ACGT');
    expect(parsed.warnings.some((w) => w.includes('quality length'))).toBe(true);
  });
});

describe('fastq-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFastqFile();
    expect(file.name).toBe('sample-reads.fastq');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleFastqFile();
    const bytes = new TextEncoder().encode(FASTQ_SAMPLE);
    const record = createFastqFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.reads.length).toBe(6);
    expect(canExportFastq(record)).toBe(true);
  });

  it('filters reads by query and quality', () => {
    const parsed = parseFastqText(FASTQ_SAMPLE);
    expect(filterFastqReads(parsed.reads, 'read_004', 0, 0).length).toBe(1);
    expect(filterFastqReads(parsed.reads, '', 0, 35).length).toBeLessThan(parsed.reads.length);
  });

  it('rejects unsupported and gzip files', () => {
    const sample = createSampleFastqFile();
    const { accepted, rejected } = filterValidFastqFiles([
      sample,
      new File(['>seq\nACGT'], 'genes.fasta', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'lane.fastq.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('.gz'))).toBe(true);
  });
});
