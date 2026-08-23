import type { FastqRelatedToolLink } from '../types/fastq-viewer.types';
import { FASTQ_SAMPLE } from './fastq-sample.data';

export const FASTQ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.fastq', '.fq', '.fnq'];

export const FASTQ_ACCEPT_ATTR = '.fastq,.fq,.fnq,text/plain';

export const FASTQ_FORMATS_LABEL = '.fastq, .fq';

export const FASTQ_FORMATS_HINT =
  'FASTQ reads stay in your browser. Quality plots, Phred decoding, and filters are for education/research only.';

export const FASTQ_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FASTQ_MAX_READS = 4000;
export const FASTQ_MAX_READ_LEN = 10_000;

export { FASTQ_SAMPLE };

export const FASTQ_RELATED_TOOLS: ReadonlyArray<FastqRelatedToolLink> = [
  { label: 'FASTA Viewer', description: 'Multi-FASTA sequences', path: '/science-viewers/fasta-viewer' },
  { label: 'VCF Variant Viewer', description: 'Genomic variant tables', path: '/science-viewers/vcf-variant-viewer' },
  { label: 'Protein Structure Viewer', description: 'PDB ribbons and residues', path: '/science-viewers/protein-structure-viewer' }
];
