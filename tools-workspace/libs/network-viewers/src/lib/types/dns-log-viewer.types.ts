export type DnsLogViewMode = 'queries' | 'timeline' | 'types' | 'table';
export type DnsLogExportFormat = 'original' | 'summary-json' | 'queries-csv' | 'types-csv' | 'png';
export type DnsLogSourceKind = 'log' | 'csv' | 'json';

export interface DnsLogRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DnsQuery {
  id: string;
  index: number;
  time: string;
  relMs: number;
  client: string;
  clientPort: number | null;
  qname: string;
  qtype: string;
  qclass: string;
  rcode: string;
  answer: string;
  flags: string;
  direction: 'query' | 'response';
}

export interface DnsTypeStat {
  name: string;
  count: number;
}

export interface DnsLogDataset {
  name: string;
  sourceKind: DnsLogSourceKind;
  queries: DnsQuery[];
  types: DnsTypeStat[];
  rcodes: DnsTypeStat[];
  durationMs: number;
  warnings: string[];
}

export interface DnsLogLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DnsLogDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DnsLogMetadataRow {
  key: string;
  value: string;
}

export interface DnsLogSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
