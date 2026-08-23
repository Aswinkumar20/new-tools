export type GribColormap = 'grayscale' | 'hot' | 'viridis';
export type GribExportFormat = 'original' | 'summary-json' | 'messages-json' | 'field-csv' | 'png';

export interface GribRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GribMessageField {
  index: number;
  discipline: number;
  category: number;
  parameterNumber: number;
  parameterName: string;
  levelType: number;
  levelValue: number;
  ni: number;
  nj: number;
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
  data: Float32Array;
  dataMin: number;
  dataMax: number;
  shape: [number, number];
}

export interface GribParsedFile {
  edition: number;
  messages: GribMessageField[];
  defaultMessageIndex: number;
  preview: GribMessageField | null;
  warnings: string[];
}

export interface GribLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: GribParsedFile | null;
  warnings: string[];
  softFail: boolean;
}

export interface GribMetadataRow {
  key: string;
  value: string;
}

export interface GribHistogramBar {
  label: string;
  count: number;
  heightPct: number;
}

export interface GribSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
