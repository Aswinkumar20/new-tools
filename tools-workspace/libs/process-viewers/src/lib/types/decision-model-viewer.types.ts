export type DecisionModelViewMode = 'tables' | 'dependencies' | 'rules' | 'table';
export type DecisionModelExportFormat = 'original' | 'summary-json' | 'rules-csv' | 'dependencies-csv' | 'png';
export type DecisionModelSourceKind = 'json' | 'dmn' | 'csv';

export interface DecisionModelRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DecisionModelDecision {
  id: string;
  index: number;
  name: string;
  kind: string;
  hitPolicy: string;
  dependsOn: string[];
  inputs: string[];
  outputs: string[];
  ruleCount: number;
}

export interface DecisionModelRule {
  id: string;
  index: number;
  decisionId: string;
  decisionName: string;
  when: string;
  then: string;
  annotation: string;
}

export interface DecisionModelDependency {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  type: string;
}

export interface DecisionModelStat {
  name: string;
  count: number;
}

export interface DecisionModelDataset {
  name: string;
  sourceKind: DecisionModelSourceKind;
  version: string;
  decisions: DecisionModelDecision[];
  rules: DecisionModelRule[];
  dependencies: DecisionModelDependency[];
  kinds: DecisionModelStat[];
  hitPolicies: DecisionModelStat[];
  warnings: string[];
}

export interface DecisionModelLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DecisionModelDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DecisionModelMetadataRow {
  key: string;
  value: string;
}

export interface DecisionModelSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
