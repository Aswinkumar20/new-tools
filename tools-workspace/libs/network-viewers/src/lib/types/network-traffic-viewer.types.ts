export type TrafficViewMode = 'flows' | 'protocols' | 'talkers' | 'table';
export type TrafficExportFormat = 'original' | 'summary-json' | 'flows-csv' | 'talkers-csv' | 'png';
export type TrafficSourceKind = 'pcap' | 'pcapng' | 'json' | 'csv' | 'flow';

export interface TrafficRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface TrafficFlow {
  id: string;
  protocol: string;
  src: string;
  dst: string;
  srcPort: number | null;
  dstPort: number | null;
  packets: number;
  bytes: number;
  startMs: number;
  endMs: number;
}

export interface TrafficTalker {
  host: string;
  packets: number;
  bytes: number;
}

export interface TrafficProtocolStat {
  name: string;
  packets: number;
  bytes: number;
}

export interface TrafficDataset {
  name: string;
  sourceKind: TrafficSourceKind;
  flows: TrafficFlow[];
  protocols: TrafficProtocolStat[];
  talkers: TrafficTalker[];
  totalPackets: number;
  totalBytes: number;
  durationMs: number;
  warnings: string[];
}

export interface TrafficLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: TrafficDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface TrafficMetadataRow {
  key: string;
  value: string;
}

export interface TrafficSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
