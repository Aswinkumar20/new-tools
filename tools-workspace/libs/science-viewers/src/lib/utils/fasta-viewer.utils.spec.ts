import { FASTA_SAMPLE } from '../constants/fasta-sample.data';
import { parseFastaText } from './fasta-parse.utils';
import { reverseComplement, translateSequence } from './sequence.utils';
import {
  canExportFasta,
  createFastaFileRecord,
  createSampleFastaFile,
  filterFastaRecords,
  filterValidFastaFiles
} from './fasta-viewer.utils';

describe('fasta-parse.utils', () => {
  it('parses the sample multi-FASTA', () => {
    const parsed = parseFastaText(FASTA_SAMPLE);
    expect(parsed.records.length).toBe(3);
    expect(parsed.records[0].id).toBe('chrM_fragment');
    expect(parsed.records[0].alphabet).toBe('dna');
    expect(parsed.records[1].id).toBe('heme_peptide');
    expect(parsed.records[1].alphabet).toBe('protein');
    expect(parsed.records[2].alphabet).toBe('rna');
    expect(parsed.records[0].length).toBeGreaterThan(100);
    expect(parsed.records[0].gcPercent).toBeGreaterThan(0);
  });

  it('reverse-complements and translates DNA', () => {
    expect(reverseComplement('ATGC')).toBe('GCAT');
    expect(translateSequence('ATGGCC')).toBe('MA');
  });
});

describe('fasta-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFastaFile();
    expect(file.name).toBe('sample-sequences.fasta');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleFastaFile();
    const bytes = new TextEncoder().encode(FASTA_SAMPLE);
    const record = createFastaFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.records.length).toBe(3);
    expect(canExportFasta(record)).toBe(true);
  });

  it('filters records by query', () => {
    const parsed = parseFastaText(FASTA_SAMPLE);
    expect(filterFastaRecords(parsed.records, 'heme').length).toBe(1);
    expect(filterFastaRecords(parsed.records, 'atgcacgc').length).toBe(1);
  });

  it('rejects unsupported and gzip files', () => {
    const sample = createSampleFastaFile();
    const { accepted, rejected } = filterValidFastaFiles([
      sample,
      new File(['x'], 'reads.fastq', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'genome.fasta.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('.gz'))).toBe(true);
  });
});
