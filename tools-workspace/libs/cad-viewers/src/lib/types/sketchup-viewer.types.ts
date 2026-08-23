export type SkViewMode = 'groups' | 'components' | 'preview' | 'table';
export type SkExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type SkSourceKind = 'sketchup' | 'json' | 'csv' | 'markdown' | 'txt';
export type SkGroupKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';

export interface SkRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SkGroup {
  id: string;
  index: number;
  name: string;
  kind: SkGroupKind;
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

export interface SkComponent {
  id: string;
  index: number;
  name: string;
  description: string;
  instanceCount: number;
}

export interface SkInstance {
  id: string;
  index: number;
  name: string;
  group: string;
  component: string;
  cx: number;
  cy: number;
  cz: number;
}

export interface SkColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface SkDataset {
  name: string;
  sourceKind: SkSourceKind;
  title: string;
  encoding: string;
  version: string;
  units: string;
  groupCount: number;
  componentCount: number;
  instanceCount: number;
  groups: SkGroup[];
  components: SkComponent[];
  instances: SkInstance[];
  columns: SkColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface SkLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SkDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SkMetadataRow {
  key: string;
  value: string;
}

export interface SkSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
