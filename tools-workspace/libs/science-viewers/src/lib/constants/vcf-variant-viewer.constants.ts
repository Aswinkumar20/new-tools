import type { VcfRelatedToolLink } from '../types/vcf-variant-viewer.types';
import { VCF_SAMPLE } from './vcf-sample.data';

export const VCF_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.vcf'];

export const VCF_ACCEPT_ATTR = '.vcf,text/x-vcf,text/plain';

export const VCF_FORMATS_LABEL = '.vcf';

export const VCF_FORMATS_HINT =
  'VCF variants stay in your browser. Filter by chromosome, type, QUAL, and PASS — education/research only. BCF/.gz not supported.';

export const VCF_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const VCF_MAX_VARIANTS = 5000;

export { VCF_SAMPLE };

export const VCF_TYPE_COLORS: Record<string, string> = {
  snp: '#22c55e',
  indel: '#f59e0b',
  mnv: '#a855f7',
  other: '#94a3b8'
};

export const VCF_RELATED_TOOLS: ReadonlyArray<VcfRelatedToolLink> = [
  { label: 'FASTA Viewer', description: 'Multi-FASTA sequences', path: '/science-viewers/fasta-viewer' },
  { label: 'FASTQ Viewer', description: 'Sequencing reads and quality', path: '/science-viewers/fastq-viewer' },
  { label: 'GenBank Viewer', description: 'Annotated sequence records', path: '/science-viewers/genbank-viewer' }
];
