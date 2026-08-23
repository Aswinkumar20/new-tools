import type { PcapRelatedToolLink } from '../types/pcap-viewer.types';

export const PCAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcap', '.cap', '.pcapng', '.dmp'];

export const PCAP_ACCEPT_ATTR = '.pcap,.cap,.pcapng,.dmp,application/vnd.tcpdump.pcap,application/octet-stream';

export const PCAP_FORMATS_LABEL = '.pcap, .pcapng';

export const PCAP_FORMATS_HINT =
  'Classic libpcap and PCAPNG captures with packet list, filters, hex, and TCP follow-stream. Education/research only.';

export const PCAP_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const PCAP_MAX_PACKETS = 8000;

export const PCAP_RELATED_TOOLS: ReadonlyArray<PcapRelatedToolLink> = [
  { label: 'HAR Viewer', description: 'Browser waterfall analysis', path: '/network-viewers/har-viewer' },
  { label: 'PCAPNG Viewer', description: 'Next-gen capture interfaces', path: '/network-viewers/pcapng-viewer' },
  { label: 'Packet Analyzer', description: 'Deep packet inspection', path: '/network-viewers/packet-analyzer' },
  { label: 'Protocol Analyzer', description: 'Protocol-centric analysis', path: '/network-viewers/protocol-analyzer' }
];
