import type {
  WellLogCurve,
  WellLogHistogramBar,
  WellLogMetadataRow,
  WellLogRelatedToolLink,
  WellLogSuggestion
} from './well-log.types';

export type DlisViewMode = 'tracks' | 'records' | 'channels';
export type DlisExportFormat = 'original' | 'summary-json' | 'channels-csv' | 'frame-csv' | 'png';

export interface DlisStorageLabel {
  sequence: string;
  version: string;
  structure: string;
  maxRecordLength: number;
  storageSetId: string;
}

export interface DlisVisibleRecord {
  index: number;
  offset: number;
  length: number;
  attributes: number;
  type: number;
  eflr: boolean;
  encrypted: boolean;
  label: string;
}

export interface DlisChannelInfo {
  mnemonic: string;
  unit: string;
  longName: string;
  representation: string;
}

export interface ParsedDlis {
  sul: DlisStorageLabel | null;
  records: DlisVisibleRecord[];
  fileId: string;
  well: string;
  company: string;
  field: string;
  frameName: string;
  indexChannel: string;
  channels: DlisChannelInfo[];
  depth: number[];
  curves: WellLogCurve[];
  extractedStrings: string[];
  warnings: string[];
}

export interface DlisLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: ParsedDlis | null;
  warnings: string[];
  softFail: boolean;
}

export type {
  WellLogCurve as DlisCurve,
  WellLogHistogramBar as DlisHistogramBar,
  WellLogMetadataRow as DlisMetadataRow,
  WellLogRelatedToolLink as DlisRelatedToolLink,
  WellLogSuggestion as DlisSuggestion
};
