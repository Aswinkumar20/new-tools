export type ErViewMode = 'diagram' | 'entities' | 'keys' | 'table';
export type ErExportFormat = 'original' | 'summary-json' | 'entities-csv' | 'keys-csv' | 'png';
export type ErSourceKind = 'puml' | 'mermaid' | 'markdown' | 'json' | 'xml' | 'txt';
export type ErKeyKind = 'pk' | 'fk' | 'unique';

export interface ErRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ErColumn {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  unique: boolean;
  nullable: boolean;
  refEntity: string;
  refColumn: string;
}

export interface ErEntity {
  id: string;
  index: number;
  name: string;
  stereotype: string;
  columns: ErColumn[];
  x: number;
  y: number;
}

export interface ErRelation {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  sourceCard: string;
  targetCard: string;
}

export interface ErKey {
  id: string;
  index: number;
  entityId: string;
  entityName: string;
  column: string;
  type: string;
  kind: ErKeyKind;
  refEntity: string;
  refColumn: string;
}

export interface ErDataset {
  name: string;
  sourceKind: ErSourceKind;
  title: string;
  entities: ErEntity[];
  relations: ErRelation[];
  keys: ErKey[];
  warnings: string[];
}

export interface ErLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ErDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ErMetadataRow {
  key: string;
  value: string;
}

export interface ErSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
