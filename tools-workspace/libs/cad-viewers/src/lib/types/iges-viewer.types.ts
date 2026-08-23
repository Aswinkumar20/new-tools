export type IgViewMode = 'surfaces' | 'entities' | 'preview' | 'table';
export type IgExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type IgSourceKind = 'iges' | 'json' | 'csv' | 'markdown' | 'txt';
export type IgSurfaceKind = 'plane' | 'cylinder' | 'sphere' | 'nurbs' | 'other';
export type IgEntityType = 'line' | 'arc' | 'point' | 'surface' | 'curve' | 'other';

export interface IgRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface IgSurface {
  id: string;
  index: number;
  name: string;
  kind: IgSurfaceKind;
  colorHex: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  h: number;
}

export interface IgEntity {
  id: string;
  index: number;
  name: string;
  type: IgEntityType;
  typeCode: number;
  surface: string;
  x: number;
  y: number;
  z: number;
  text: string;
}

export interface IgColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface IgDataset {
  name: string;
  sourceKind: IgSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  surfaceCount: number;
  entityCount: number;
  surfaces: IgSurface[];
  entities: IgEntity[];
  columns: IgColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface IgLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: IgDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface IgMetadataRow {
  key: string;
  value: string;
}

export interface IgSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
