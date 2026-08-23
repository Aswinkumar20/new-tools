import type { FastaRelatedToolLink } from '../types/fasta-viewer.types';
import { FASTA_SAMPLE } from './fasta-sample.data';

export const FASTA_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.fasta', '.fa', '.fna', '.faa', '.ffn', '.fas'];

export const FASTA_ACCEPT_ATTR = '.fasta,.fa,.fna,.faa,.ffn,.fas,text/x-fasta,text/plain';

export const FASTA_FORMATS_LABEL = '.fasta, .fa, .fna, .faa';

export const FASTA_FORMATS_HINT =
  'FASTA sequences stay in your browser. Search, wrap, reverse-complement, and composition charts are for education/research only.';

export const FASTA_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FASTA_MAX_RECORDS = 1500;
export const FASTA_MAX_SEQ_CHARS = 250_000;

export { FASTA_SAMPLE };

export const FASTA_RELATED_TOOLS: ReadonlyArray<FastaRelatedToolLink> = [
  { label: 'FASTQ Viewer', description: 'Sequencing reads and quality', path: '/science-viewers/fastq-viewer' },
  { label: 'Protein Structure Viewer', description: 'PDB ribbons and residues', path: '/science-viewers/protein-structure-viewer' },
  { label: 'GenBank Viewer', description: 'Annotated sequence records', path: '/science-viewers/genbank-viewer' }
];
