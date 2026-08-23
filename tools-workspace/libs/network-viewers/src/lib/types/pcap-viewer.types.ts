export type PcapViewMode = 'packets' | 'timeline' | 'hex' | 'stream' | 'table';
export type PcapExportFormat = 'original' | 'summary-json' | 'packets-csv' | 'stream-txt' | 'png';

export interface PcapRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PcapPacket {
  index: number;
  tsSec: number;
  tsUsec: number;
  relMs: number;
  inclLen: number;
  origLen: number;
  bytes: Uint8Array;
  srcMac: string;
  dstMac: string;
  ethertype: number;
  ipVersion: 0 | 4 | 6;
  srcIp: string;
  dstIp: string;
  protocol: string;
  srcPort: number | null;
  dstPort: number | null;
  tcpFlags: string;
  info: string;
  payload: Uint8Array;
}

export interface PcapStream {
  id: string;
  protocol: string;
  src: string;
  dst: string;
  packetIndexes: number[];
  bytes: number;
  text: string;
}

export interface PcapDataset {
  format: 'pcap' | 'pcapng';
  linkType: number;
  linkTypeName: string;
  snaplen: number;
  littleEndian: boolean;
  nanosecond: boolean;
  packets: PcapPacket[];
  streams: PcapStream[];
  warnings: string[];
}

export interface PcapLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: PcapDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PcapMetadataRow {
  key: string;
  value: string;
}

export interface PcapSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
