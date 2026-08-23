import type {
  SequenceHistogramBar,
  SequenceMetadataRow,
  SequenceRelatedToolLink,
  SequenceSuggestion
} from './sequence.types';

export type VcfViewMode = 'table' | 'chromosomes';
export type VcfVariantType = 'snp' | 'indel' | 'mnv' | 'other';
export type VcfExportFormat = 'original' | 'summary-json' | 'variants-csv' | 'filtered-vcf' | 'png';

export interface VcfMetaHeader {
  key: string;
  value: string;
}

export interface VcfInfoEntry {
  key: string;
  value: string;
}

export interface VcfSampleCall {
  sample: string;
  genotype: string;
  fields: Record<string, string>;
}

export interface VcfVariant {
  index: number;
  chrom: string;
  pos: number;
  id: string;
  ref: string;
  alt: string[];
  qual: number | null;
  filter: string;
  info: VcfInfoEntry[];
  infoRaw: string;
  format: string;
  samples: VcfSampleCall[];
  type: VcfVariantType;
  pass: boolean;
}

export interface VcfChromCount {
  chrom: string;
  count: number;
  snp: number;
  indel: number;
}

export interface ParsedVcf {
  version: string;
  meta: VcfMetaHeader[];
  columns: string[];
  sampleNames: string[];
  variants: VcfVariant[];
  totalVariants: number;
  chromCounts: VcfChromCount[];
  warnings: string[];
  truncated: boolean;
}

export interface VcfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedVcf | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  SequenceHistogramBar as VcfHistogramBar,
  SequenceMetadataRow as VcfMetadataRow,
  SequenceRelatedToolLink as VcfRelatedToolLink,
  SequenceSuggestion as VcfSuggestion
};
