import type {
  SequenceHistogramBar,
  SequenceMetadataRow,
  SequenceRelatedToolLink,
  SequenceSuggestion
} from './sequence.types';

export type FastqEncoding = 'phred33' | 'phred64';
export type FastqViewMode = 'reads' | 'quality';
export type FastqExportFormat = 'original' | 'summary-json' | 'reads-csv' | 'filtered-fastq' | 'png';

export interface FastqRead {
  index: number;
  id: string;
  description: string;
  sequence: string;
  quality: string;
  length: number;
  meanQ: number;
  minQ: number;
  maxQ: number;
  gcPercent: number;
  nCount: number;
  scores: number[];
}

export interface ParsedFastq {
  encoding: FastqEncoding;
  reads: FastqRead[];
  totalReads: number;
  meanLength: number;
  meanQ: number;
  perPositionMeanQ: number[];
  qualityHistogram: number[];
  warnings: string[];
  truncated: boolean;
}

export interface FastqLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedFastq | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  SequenceHistogramBar as FastqHistogramBar,
  SequenceMetadataRow as FastqMetadataRow,
  SequenceRelatedToolLink as FastqRelatedToolLink,
  SequenceSuggestion as FastqSuggestion
};
