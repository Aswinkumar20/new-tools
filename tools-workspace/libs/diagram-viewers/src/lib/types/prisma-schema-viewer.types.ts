export type PrmViewMode = 'diagram' | 'models' | 'relations' | 'table';
export type PrmExportFormat = 'original' | 'summary-json' | 'models-csv' | 'relations-csv' | 'png';
export type PrmSourceKind = 'prisma' | 'markdown' | 'json' | 'xml' | 'txt';
export type PrmRelationKind = '1-1' | '1-n' | 'n-n';

export interface PrmRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PrmField {
  name: string;
  type: string;
  isId: boolean;
  isUnique: boolean;
  optional: boolean;
  list: boolean;
  relation: boolean;
  note: string;
}

export interface PrmModel {
  id: string;
  index: number;
  name: string;
  kind: 'model' | 'enum';
  fields: PrmField[];
  x: number;
  y: number;
}

export interface PrmRelation {
  id: string;
  index: number;
  name: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  sourceField: string;
  targetField: string;
  kind: PrmRelationKind;
}

export interface PrmDataset {
  name: string;
  sourceKind: PrmSourceKind;
  title: string;
  provider: string;
  models: PrmModel[];
  relations: PrmRelation[];
  warnings: string[];
}

export interface PrmLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PrmDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PrmMetadataRow {
  key: string;
  value: string;
}

export interface PrmSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
