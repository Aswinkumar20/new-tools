export type DmnViewMode = 'tables' | 'drd' | 'rules' | 'table';
export type DmnExportFormat = 'original' | 'summary-json' | 'rules-csv' | 'tables-csv' | 'png';
export type DmnSourceKind = 'dmn' | 'json' | 'csv';

export interface DmnRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DmnClause {
  id: string;
  label: string;
  expression: string;
  typeRef: string;
}

export interface DmnRule {
  id: string;
  index: number;
  tableId: string;
  tableName: string;
  hitPolicy: string;
  inputs: string[];
  outputs: string[];
  annotation: string;
}

export interface DmnDecisionTable {
  id: string;
  name: string;
  hitPolicy: string;
  inputs: DmnClause[];
  outputs: DmnClause[];
  ruleCount: number;
}

export interface DmnDrdNode {
  id: string;
  name: string;
  kind: string;
}

export interface DmnDrdEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface DmnStat {
  name: string;
  count: number;
}

export interface DmnDataset {
  name: string;
  sourceKind: DmnSourceKind;
  namespace: string;
  tables: DmnDecisionTable[];
  rules: DmnRule[];
  nodes: DmnDrdNode[];
  edges: DmnDrdEdge[];
  hitPolicies: DmnStat[];
  nodeKinds: DmnStat[];
  warnings: string[];
}

export interface DmnLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DmnDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DmnMetadataRow {
  key: string;
  value: string;
}

export interface DmnSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
