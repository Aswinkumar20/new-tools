import type {
  SequenceHistogramBar,
  SequenceMetadataRow,
  SequenceRelatedToolLink,
  SequenceSuggestion
} from './sequence.types';

export type GenbankViewMode = 'map' | 'features' | 'sequence';
export type GenbankWrap = 60 | 80 | 100 | 0;
export type GenbankExportFormat = 'original' | 'summary-json' | 'features-csv' | 'selected-fasta' | 'png';

export interface GenbankQualifier {
  key: string;
  value: string;
}

export interface GenbankSpan {
  start: number;
  end: number;
  complement: boolean;
}

export interface GenbankFeature {
  index: number;
  type: string;
  location: string;
  spans: GenbankSpan[];
  start: number;
  end: number;
  complement: boolean;
  qualifiers: GenbankQualifier[];
  gene: string;
  product: string;
  note: string;
  locusTag: string;
}

export interface GenbankRecord {
  index: number;
  locus: string;
  length: number;
  molType: string;
  topology: string;
  division: string;
  definition: string;
  accession: string;
  version: string;
  keywords: string;
  source: string;
  organism: string;
  references: string[];
  features: GenbankFeature[];
  sequence: string;
  featureTypes: string[];
}

export interface ParsedGenbank {
  records: GenbankRecord[];
  totalRecords: number;
  warnings: string[];
  truncated: boolean;
}

export interface GenbankLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedGenbank | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  SequenceHistogramBar as GenbankHistogramBar,
  SequenceMetadataRow as GenbankMetadataRow,
  SequenceRelatedToolLink as GenbankRelatedToolLink,
  SequenceSuggestion as GenbankSuggestion
};
