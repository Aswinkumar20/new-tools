import type {
  WellLogCurve,
  WellLogHeaderRow,
  WellLogHistogramBar,
  WellLogMetadataRow,
  WellLogRelatedToolLink,
  WellLogSuggestion
} from './well-log.types';

export type LasViewMode = 'tracks' | 'crossplot' | 'histogram' | 'table';
export type LasExportFormat = 'original' | 'summary-json' | 'curves-csv' | 'subset-las' | 'png';

export interface ParsedLas {
  version: string;
  wrap: boolean;
  nullValue: number;
  startDepth: number | null;
  stopDepth: number | null;
  step: number | null;
  depthUnit: string;
  well: WellLogHeaderRow[];
  parameters: WellLogHeaderRow[];
  other: string;
  depth: number[];
  curves: WellLogCurve[];
  warnings: string[];
}

export interface LasLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedLas | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  WellLogCurve as LasCurve,
  WellLogHeaderRow as LasHeaderRow,
  WellLogHistogramBar as LasHistogramBar,
  WellLogMetadataRow as LasMetadataRow,
  WellLogRelatedToolLink as LasRelatedToolLink,
  WellLogSuggestion as LasSuggestion
};
