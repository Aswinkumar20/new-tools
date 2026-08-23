export type PnmlViewMode = 'places' | 'transitions' | 'tokens' | 'table';
export type PnmlExportFormat = 'original' | 'summary-json' | 'places-csv' | 'arcs-csv' | 'png';
export type PnmlSourceKind = 'pnml' | 'json' | 'csv';

export interface PnmlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PnmlPlace {
  id: string;
  index: number;
  name: string;
  tokens: number;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface PnmlTransition {
  id: string;
  index: number;
  name: string;
  enabled: boolean;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface PnmlArc {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  weight: number;
}

export interface PnmlTokenMarking {
  id: string;
  index: number;
  placeId: string;
  placeName: string;
  tokens: number;
}

export interface PnmlStat {
  name: string;
  count: number;
}

export interface PnmlDataset {
  name: string;
  sourceKind: PnmlSourceKind;
  netType: string;
  places: PnmlPlace[];
  transitions: PnmlTransition[];
  arcs: PnmlArc[];
  tokens: PnmlTokenMarking[];
  tokenTotal: number;
  enabledCount: number;
  warnings: string[];
}

export interface PnmlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PnmlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PnmlMetadataRow {
  key: string;
  value: string;
}

export interface PnmlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
