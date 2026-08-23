export type SequenceAlphabet = 'dna' | 'rna' | 'protein' | 'mixed' | 'unknown';

export interface SequenceComposition {
  [symbol: string]: number;
}

export interface SequenceRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SequenceSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface SequenceMetadataRow {
  key: string;
  value: string;
}

export interface SequenceHistogramBar {
  label: string;
  count: number;
  heightPct: number;
  color: string;
}

export interface SequenceWrapLine {
  start: number;
  text: string;
}
