export type FirewallViewMode = 'events' | 'timeline' | 'actions' | 'table';
export type FirewallExportFormat = 'original' | 'summary-json' | 'events-csv' | 'actions-csv' | 'png';
export type FirewallSourceKind = 'log' | 'csv' | 'json';

export interface FirewallRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface FirewallEvent {
  id: string;
  index: number;
  time: string;
  relMs: number;
  action: string;
  src: string;
  dst: string;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string;
  rule: string;
  iface: string;
  message: string;
}

export interface FirewallActionStat {
  name: string;
  count: number;
  bytesHint: number;
}

export interface FirewallDataset {
  name: string;
  sourceKind: FirewallSourceKind;
  events: FirewallEvent[];
  actions: FirewallActionStat[];
  durationMs: number;
  warnings: string[];
}

export interface FirewallLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: FirewallDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface FirewallMetadataRow {
  key: string;
  value: string;
}

export interface FirewallSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
