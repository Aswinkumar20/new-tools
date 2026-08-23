export type EgViewMode = 'board' | 'schematic' | 'stack' | 'table';
export type EgExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type EgSourceKind = 'eagle' | 'json' | 'csv' | 'markdown' | 'txt';
export type EgBoardType = 'wire' | 'via' | 'pad' | 'rect' | 'text' | 'other';
export type EgSchType = 'instance' | 'schwire' | 'pin' | 'label' | 'text' | 'other';
export type EgLayerFunction = 'copper' | 'silk' | 'mask' | 'paste' | 'outline' | 'other';
export type EgNetClass = 'power' | 'signal' | 'ground' | 'other';

export interface EgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EgLayer {
  id: string;
  index: number;
  name: string;
  function: EgLayerFunction;
  stackIndex: number;
  color: number;
  colorHex: string;
  visible: boolean;
  itemCount: number;
}

export interface EgNet {
  id: string;
  index: number;
  name: string;
  netClass: EgNetClass;
  itemCount: number;
}

export interface EgBoardItem {
  id: string;
  index: number;
  name: string;
  type: EgBoardType;
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

export interface EgSchItem {
  id: string;
  index: number;
  name: string;
  type: EgSchType;
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

export interface EgColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface EgDataset {
  name: string;
  sourceKind: EgSourceKind;
  title: string;
  encoding: string;
  eagleVer: string;
  units: string;
  layerCount: number;
  netCount: number;
  boardCount: number;
  schCount: number;
  layers: EgLayer[];
  nets: EgNet[];
  boardItems: EgBoardItem[];
  schItems: EgSchItem[];
  columns: EgColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface EgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: EgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface EgMetadataRow {
  key: string;
  value: string;
}

export interface EgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
