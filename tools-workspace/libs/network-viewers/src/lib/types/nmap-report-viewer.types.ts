export type NmapViewMode = 'hosts' | 'ports' | 'services' | 'table';
export type NmapExportFormat = 'original' | 'summary-json' | 'hosts-csv' | 'ports-csv' | 'png';
export type NmapSourceKind = 'xml' | 'gnmap' | 'json' | 'csv';

export interface NmapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface NmapPort {
  id: string;
  hostId: string;
  ip: string;
  hostname: string;
  protocol: string;
  port: number;
  state: string;
  service: string;
  product: string;
  version: string;
}

export interface NmapHost {
  id: string;
  index: number;
  ip: string;
  hostname: string;
  status: string;
  os: string;
  ports: NmapPort[];
  openCount: number;
}

export interface NmapStat {
  name: string;
  count: number;
}

export interface NmapDataset {
  name: string;
  sourceKind: NmapSourceKind;
  args: string;
  hosts: NmapHost[];
  ports: NmapPort[];
  services: NmapStat[];
  states: NmapStat[];
  warnings: string[];
}

export interface NmapLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: NmapDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface NmapMetadataRow {
  key: string;
  value: string;
}

export interface NmapSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
