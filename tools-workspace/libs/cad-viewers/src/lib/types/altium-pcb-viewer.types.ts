export type AlViewMode = 'copper' | 'designators' | 'stack' | 'table';
export type AlExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type AlSourceKind = 'altium' | 'json' | 'csv' | 'markdown' | 'txt';
export type AlCopperType = 'track' | 'via' | 'pad' | 'zone' | 'other';
export type AlDesType = 'designator' | 'text' | 'component' | 'other';
export type AlLayerFunction = 'copper' | 'silk' | 'mask' | 'paste' | 'outline' | 'other';
export type AlNetClass = 'power' | 'signal' | 'ground' | 'other';

export interface AlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface AlLayer {
  id: string;
  index: number;
  name: string;
  function: AlLayerFunction;
  stackIndex: number;
  color: number;
  colorHex: string;
  visible: boolean;
  itemCount: number;
}

export interface AlNet {
  id: string;
  index: number;
  name: string;
  netClass: AlNetClass;
  itemCount: number;
}

export interface AlCopper {
  id: string;
  index: number;
  name: string;
  type: AlCopperType;
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

export interface AlDesignator {
  id: string;
  index: number;
  name: string;
  type: AlDesType;
  layer: string;
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

export interface AlColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface AlDataset {
  name: string;
  sourceKind: AlSourceKind;
  title: string;
  encoding: string;
  altiumVer: string;
  units: string;
  layerCount: number;
  netCount: number;
  copperCount: number;
  desCount: number;
  layers: AlLayer[];
  nets: AlNet[];
  coppers: AlCopper[];
  designators: AlDesignator[];
  columns: AlColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface AlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: AlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface AlMetadataRow {
  key: string;
  value: string;
}

export interface AlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
