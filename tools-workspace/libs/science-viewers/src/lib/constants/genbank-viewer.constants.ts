import type { GenbankRelatedToolLink } from '../types/genbank-viewer.types';
import { GENBANK_SAMPLE } from './genbank-sample.data';

export const GENBANK_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.gb', '.gbk', '.genbank', '.gbf', '.gbff'];

export const GENBANK_ACCEPT_ATTR = '.gb,.gbk,.genbank,.gbf,.gbff,chemical/seq-na-genbank,text/plain';

export const GENBANK_FORMATS_LABEL = '.gb, .gbk, .gbff';

export const GENBANK_FORMATS_HINT =
  'GenBank records stay in your browser. Feature maps, CDS translation, and sequence preview are for education/research only.';

export const GENBANK_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const GENBANK_MAX_RECORDS = 40;
export const GENBANK_MAX_SEQ_CHARS = 250_000;
export const GENBANK_MAX_FEATURES = 2000;

export { GENBANK_SAMPLE };

export const GENBANK_FEATURE_COLORS: Record<string, string> = {
  source: '#64748b',
  gene: '#38bdf8',
  cds: '#22c55e',
  mrna: '#14b8a6',
  exon: '#2dd4bf',
  intron: '#94a3b8',
  trna: '#a855f7',
  rrna: '#c084fc',
  promoter: '#f59e0b',
  terminator: '#fb923c',
  stem_loop: '#f97316',
  regulatory: '#eab308',
  misc_feature: '#fb7185',
  repeat_region: '#f472b6'
};

export const GENBANK_RELATED_TOOLS: ReadonlyArray<GenbankRelatedToolLink> = [
  { label: 'FASTA Viewer', description: 'Multi-FASTA sequences', path: '/science-viewers/fasta-viewer' },
  { label: 'VCF Variant Viewer', description: 'Genomic variant tables', path: '/science-viewers/vcf-variant-viewer' },
  { label: 'Protein Structure Viewer', description: 'PDB ribbons and residues', path: '/science-viewers/protein-structure-viewer' }
];
