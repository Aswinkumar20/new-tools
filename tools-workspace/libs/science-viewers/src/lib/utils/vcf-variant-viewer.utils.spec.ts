import { VCF_SAMPLE } from '../constants/vcf-sample.data';
import { classifyVcfType, parseVcfText } from './vcf-parse.utils';
import {
  canExportVcf,
  createSampleVcfFile,
  createVcfFileRecord,
  filterValidVcfFiles,
  filterVcfVariants
} from './vcf-variant-viewer.utils';

describe('vcf-parse.utils', () => {
  it('parses the sample VCF', () => {
    const parsed = parseVcfText(VCF_SAMPLE);
    expect(parsed.version).toContain('4.2');
    expect(parsed.variants.length).toBe(6);
    expect(parsed.sampleNames).toEqual(['S1', 'S2']);
    expect(parsed.chromCounts.map((c) => c.chrom)).toEqual(['chr1', 'chr2']);
    expect(parsed.variants[0].type).toBe('snp');
    expect(parsed.variants[1].type).toBe('indel');
    expect(parsed.variants[0].samples[0].genotype).toBe('0/1');
  });

  it('classifies variant types', () => {
    expect(classifyVcfType('A', ['G'])).toBe('snp');
    expect(classifyVcfType('AT', ['A'])).toBe('indel');
    expect(classifyVcfType('AT', ['GC'])).toBe('mnv');
  });
});

describe('vcf-variant-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleVcfFile();
    expect(file.name).toBe('sample-variants.vcf');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleVcfFile();
    const bytes = new TextEncoder().encode(VCF_SAMPLE);
    const record = createVcfFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.variants.length).toBe(6);
    expect(canExportVcf(record)).toBe(true);
  });

  it('filters variants by chrom, type, PASS, and QUAL', () => {
    const parsed = parseVcfText(VCF_SAMPLE);
    expect(filterVcfVariants(parsed.variants, { query: '', chrom: 'chr2', type: null, minQual: 0, passOnly: false }).length).toBe(3);
    expect(filterVcfVariants(parsed.variants, { query: '', chrom: null, type: 'snp', minQual: 0, passOnly: false }).every((v) => v.type === 'snp')).toBe(true);
    expect(filterVcfVariants(parsed.variants, { query: '', chrom: null, type: null, minQual: 0, passOnly: true }).every((v) => v.pass)).toBe(true);
    expect(filterVcfVariants(parsed.variants, { query: 'rseth1', chrom: null, type: null, minQual: 0, passOnly: false }).length).toBe(1);
    expect(filterVcfVariants(parsed.variants, { query: '', chrom: null, type: null, minQual: 90, passOnly: false }).every((v) => (v.qual ?? 0) >= 90)).toBe(true);
  });

  it('rejects unsupported gzip and bcf files', () => {
    const sample = createSampleVcfFile();
    const { accepted, rejected } = filterValidVcfFiles([
      sample,
      new File(['x'], 'genes.fasta', { type: 'text/plain', lastModified: 1 }),
      new File(['x'], 'calls.vcf.gz', { type: 'application/gzip', lastModified: 2 }),
      new File(['x'], 'calls.bcf', { type: 'application/octet-stream', lastModified: 3 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('.vcf.gz') || item.reason.includes('gz'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('BCF'))).toBe(true);
  });
});
