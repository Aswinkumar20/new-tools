export type NessusViewMode = 'findings' | 'hosts' | 'severity' | 'table';
export type NessusExportFormat = 'original' | 'summary-json' | 'findings-csv' | 'hosts-csv' | 'png';
export type NessusSourceKind = 'nessus' | 'json' | 'csv';

export interface NessusRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NessusFinding {
  id: string;
  index: number;
  host: string;
  ip: string;
  port: number;
  protocol: string;
  severity: string;
  pluginId: string;
  pluginName: string;
  synopsis: string;
  solution: string;
  cvss: number | null;
  cve: string;
}

export interface NessusHostStat {
  name: string;
  ip: string;
  count: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface NessusSeverityStat {
  name: string;
  count: number;
}

export interface NessusDataset {
  name: string;
  sourceKind: NessusSourceKind;
  findings: NessusFinding[];
  hosts: NessusHostStat[];
  severities: NessusSeverityStat[];
  warnings: string[];
}

export interface NessusLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: NessusDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface NessusMetadataRow {
  key: string;
  value: string;
}

export interface NessusSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
