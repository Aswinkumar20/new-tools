export type IcViewMode = 'building' | 'properties' | 'disciplines' | 'table';
export type IcExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type IcSourceKind = 'ifc' | 'json' | 'csv' | 'markdown' | 'txt';
export type IcElementKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type IcIfcType =
  | 'IfcSlab'
  | 'IfcWall'
  | 'IfcColumn'
  | 'IfcFurnishingElement'
  | 'IfcBuildingElementProxy'
  | 'IfcFlowSegment'
  | 'other';
export type IcDisciplineKind = 'Architecture' | 'Structure' | 'MEP' | 'other';

export interface IcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface IcElement {
  id: string;
  index: number;
  name: string;
  kind: IcElementKind;
  ifcType: IcIfcType;
  discipline: IcDisciplineKind;
  colorHex: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  h: number;
  volume: number;
}

export interface IcProperty {
  id: string;
  index: number;
  name: string;
  pset: string;
  element: string;
  value: string;
  unit: string;
}

export interface IcDiscipline {
  id: string;
  index: number;
  name: IcDisciplineKind | string;
  description: string;
  elementCount: number;
}

export interface IcColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface IcDataset {
  name: string;
  sourceKind: IcSourceKind;
  title: string;
  encoding: string;
  ifcVer: string;
  units: string;
  elementCount: number;
  propCount: number;
  discCount: number;
  elements: IcElement[];
  properties: IcProperty[];
  disciplines: IcDiscipline[];
  columns: IcColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface IcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: IcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface IcMetadataRow {
  key: string;
  value: string;
}

export interface IcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
