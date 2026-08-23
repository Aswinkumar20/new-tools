export type FuViewMode = 'bodies' | 'components' | 'preview' | 'table';
export type FuExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type FuSourceKind = 'fusion' | 'json' | 'csv' | 'markdown' | 'txt';
export type FuBodyKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface FuRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FuBody {
  id: string;
  index: number;
  name: string;
  kind: FuBodyKind;
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

export interface FuComponent {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface FuInstance {
  id: string;
  index: number;
  name: string;
  body: string;
  component: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface FuColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface FuDataset {
  name: string;
  sourceKind: FuSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  bodyCount: number;
  componentCount: number;
  instanceCount: number;
  bodies: FuBody[];
  components: FuComponent[];
  instances: FuInstance[];
  columns: FuColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface FuLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FuDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FuMetadataRow {
  key: string;
  value: string;
}

export interface FuSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
