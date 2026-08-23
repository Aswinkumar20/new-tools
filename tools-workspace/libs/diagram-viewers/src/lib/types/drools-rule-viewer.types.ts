export type DrlViewMode = 'diagram' | 'rules' | 'conditions' | 'table';
export type DrlExportFormat = 'original' | 'summary-json' | 'rules-csv' | 'conditions-csv' | 'png';
export type DrlSourceKind = 'drl' | 'json' | 'xml' | 'markdown' | 'txt';

export interface DrlRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DrlRule {
  id: string;
  index: number;
  name: string;
  salience: string;
  agendaGroup: string;
  whenText: string;
  thenText: string;
  x: number;
  y: number;
}

export interface DrlCondition {
  id: string;
  index: number;
  ruleId: string;
  ruleName: string;
  factType: string;
  constraints: string;
  modifier: string;
  x: number;
  y: number;
}

export interface DrlDataset {
  name: string;
  sourceKind: DrlSourceKind;
  title: string;
  packageName: string;
  rules: DrlRule[];
  conditions: DrlCondition[];
  warnings: string[];
}

export interface DrlLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DrlDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DrlMetadataRow {
  key: string;
  value: string;
}

export interface DrlSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
