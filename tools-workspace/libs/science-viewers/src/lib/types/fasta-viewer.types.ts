import type {
  SequenceAlphabet,
  SequenceComposition,
  SequenceHistogramBar,
  SequenceMetadataRow,
  SequenceRelatedToolLink,
  SequenceSuggestion
} from './sequence.types';

export type FastaWrap = 60 | 80 | 100 | 0;
export type FastaViewMode = 'sequence' | 'composition';
export type FastaExportFormat = 'original' | 'summary-json' | 'sequences-csv' | 'selected-fasta' | 'png';

export interface FastaRecord {
  index: number;
  id: string;
  description: string;
  header: string;
  sequence: string;
  length: number;
  alphabet: SequenceAlphabet;
  gcPercent: number | null;
  composition: SequenceComposition;
  nCount: number;
  truncated: boolean;
}

export interface ParsedFasta {
  records: FastaRecord[];
  totalRecords: number;
  totalLength: number;
  alphabetSummary: SequenceAlphabet;
  warnings: string[];
  truncated: boolean;
}

export interface FastaLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedFasta | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  SequenceHistogramBar as FastaHistogramBar,
  SequenceMetadataRow as FastaMetadataRow,
  SequenceRelatedToolLink as FastaRelatedToolLink,
  SequenceSuggestion as FastaSuggestion
};
