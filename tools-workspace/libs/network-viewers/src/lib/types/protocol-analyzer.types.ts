import type { PcapPacket } from './pcap-viewer.types';

export type ProtocolAnalyzerViewMode = 'dissectors' | 'timeline' | 'protocols' | 'table';
export type ProtocolAnalyzerExportFormat = 'original' | 'summary-json' | 'protocols-csv' | 'dissectors-csv' | 'png';
export type ProtocolSourceKind = 'pcap' | 'pcapng' | 'json';

export interface ProtocolAnalyzerRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ProtocolDissector {
  name: string;
  packets: number;
  bytes: number;
  ports: number[];
  conversations: number;
  firstMs: number;
  lastMs: number;
  sampleInfo: string[];
}

export interface ProtocolAnalyzerDataset {
  name: string;
  sourceKind: ProtocolSourceKind;
  dissectors: ProtocolDissector[];
  packets: PcapPacket[];
  totalPackets: number;
  totalBytes: number;
  durationMs: number;
  warnings: string[];
}

export interface ProtocolAnalyzerLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: ProtocolAnalyzerDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ProtocolAnalyzerMetadataRow {
  key: string;
  value: string;
}

export interface ProtocolAnalyzerSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
