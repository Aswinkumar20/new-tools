export type KcViewMode = 'board' | 'schematic' | 'stack' | 'table';
export type KcExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type KcSourceKind = 'kicad' | 'json' | 'csv' | 'markdown' | 'txt';
export type KcBoardType = 'track' | 'via' | 'pad' | 'zone' | 'footprint' | 'text' | 'other';
export type KcSchType = 'symbol' | 'wire' | 'pin' | 'label' | 'text' | 'power' | 'other';
export type KcLayerFunction = 'copper' | 'silk' | 'mask' | 'paste' | 'outline' | 'other';
export type KcNetClass = 'power' | 'signal' | 'ground' | 'other';

export interface KcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface KcLayer {
  id: string;
  index: number;
  name: string;
  function: KcLayerFunction;
  stackIndex: number;
  color: number;
  colorHex: string;
  visible: boolean;
  itemCount: number;
}

export interface KcNet {
  id: string;
  index: number;
  name: string;
  netClass: KcNetClass;
  itemCount: number;
}

export interface KcBoardItem {
  id: string;
  index: number;
  name: string;
  type: KcBoardType;
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

export interface KcSchItem {
  id: string;
  index: number;
  name: string;
  type: KcSchType;
  net: string;
  colorHex: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  text: string;
  length: number;
  points: Array<{ x: number; y: number }>;
}

export interface KcColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface KcDataset {
  name: string;
  sourceKind: KcSourceKind;
  title: string;
  encoding: string;
  kicadVer: string;
  units: string;
  layerCount: number;
  netCount: number;
  boardCount: number;
  schCount: number;
  layers: KcLayer[];
  nets: KcNet[];
  boardItems: KcBoardItem[];
  schItems: KcSchItem[];
  columns: KcColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface KcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: KcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface KcMetadataRow {
  key: string;
  value: string;
}

export interface KcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
