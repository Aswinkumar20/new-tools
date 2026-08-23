export type SarifViewMode = 'results' | 'rules' | 'locations' | 'table';
export type SarifExportFormat = 'original' | 'summary-json' | 'results-csv' | 'rules-csv' | 'png';
export type SarifSourceKind = 'sarif' | 'json' | 'csv';

export interface SarifRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SarifResult {
  id: string;
  index: number;
  ruleId: string;
  ruleName: string;
  level: string;
  message: string;
  file: string;
  startLine: number | null;
  startColumn: number | null;
  endLine: number | null;
  snippet: string;
  tool: string;
}

export interface SarifRuleStat {
  id: string;
  name: string;
  level: string;
  count: number;
  description: string;
}

export interface SarifLocationStat {
  file: string;
  count: number;
}

export interface SarifLevelStat {
  name: string;
  count: number;
}

export interface SarifDataset {
  name: string;
  sourceKind: SarifSourceKind;
  version: string;
  tool: string;
  results: SarifResult[];
  rules: SarifRuleStat[];
  locations: SarifLocationStat[];
  levels: SarifLevelStat[];
  warnings: string[];
}

export interface SarifLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SarifDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SarifMetadataRow {
  key: string;
  value: string;
}

export interface SarifSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
