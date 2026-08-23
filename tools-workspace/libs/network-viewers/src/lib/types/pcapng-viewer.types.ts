import type { PcapPacket } from './pcap-viewer.types';

export type PcapngViewMode = 'interfaces' | 'packets' | 'timeline' | 'table';
export type PcapngExportFormat = 'original' | 'summary-json' | 'interfaces-csv' | 'packets-csv' | 'png';

export interface PcapngRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PcapngSectionInfo {
  hardware: string;
  os: string;
  application: string;
}

export interface PcapngInterface {
  id: number;
  name: string;
  description: string;
  linkType: number;
  linkTypeName: string;
  snaplen: number;
  mac: string;
  speedBps: number;
  tsresol: number;
  packets: number;
  bytes: number;
  received: number;
  dropped: number;
}

export interface PcapngPacket extends PcapPacket {
  interfaceId: number;
  interfaceName: string;
}

export interface PcapngDataset {
  section: PcapngSectionInfo;
  littleEndian: boolean;
  interfaces: PcapngInterface[];
  packets: PcapngPacket[];
  warnings: string[];
}

export interface PcapngLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: PcapngDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PcapngMetadataRow {
  key: string;
  value: string;
}

export interface PcapngSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
