export type PbViewMode = 'plot' | 'stack' | 'nets' | 'table';
export type PbExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type PbSourceKind = 'pcb' | 'json' | 'csv' | 'markdown' | 'txt';
export type PbTraceType = 'track' | 'via' | 'pad' | 'zone' | 'text' | 'other';
export type PbLayerFunction = 'copper' | 'silk' | 'mask' | 'paste' | 'outline' | 'other';
export type PbNetClass = 'power' | 'signal' | 'ground' | 'other';

export interface PbRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PbLayer {
  id: string;
  index: number;
  name: string;
  function: PbLayerFunction;
  stackIndex: number;
  color: number;
  colorHex: string;
  visible: boolean;
  traceCount: number;
}

export interface PbNet {
  id: string;
  index: number;
  name: string;
  netClass: PbNetClass;
  traceCount: number;
}

export interface PbTrace {
  id: string;
  index: number;
  name: string;
  type: PbTraceType;
  layer: string;
  net: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  width: number;
  text: string;
  length: number;
  points: Array<{ x: number; y: number }>;
}

export interface PbColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface PbDataset {
  name: string;
  sourceKind: PbSourceKind;
  title: string;
  encoding: string;
  boardVer: string;
  units: string;
  layerCount: number;
  netCount: number;
  traceCount: number;
  layers: PbLayer[];
  nets: PbNet[];
  traces: PbTrace[];
  columns: PbColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface PbLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PbDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PbMetadataRow {
  key: string;
  value: string;
}

export interface PbSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
