import type { PcapPacket } from './pcap-viewer.types';

export type PacketAnalyzerViewMode = 'decode' | 'hex' | 'layers' | 'table';
export type PacketAnalyzerExportFormat = 'original' | 'summary-json' | 'decode-json' | 'packets-csv' | 'png';

export interface PacketAnalyzerRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PacketField {
  name: string;
  value: string;
  offset: number;
  length: number;
}

export interface PacketLayer {
  id: string;
  name: string;
  summary: string;
  offset: number;
  length: number;
  fields: PacketField[];
}

export interface PacketAnalyzerPacket extends PcapPacket {
  layers: PacketLayer[];
}

export interface PacketAnalyzerDataset {
  format: 'pcap' | 'pcapng' | 'hex';
  linkType: number;
  linkTypeName: string;
  packets: PacketAnalyzerPacket[];
  warnings: string[];
}

export interface PacketAnalyzerLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: PacketAnalyzerDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PacketAnalyzerMetadataRow {
  key: string;
  value: string;
}

export interface PacketAnalyzerSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
