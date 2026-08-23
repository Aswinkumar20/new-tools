import type { PcapngRelatedToolLink } from '../types/pcapng-viewer.types';

export const PCAPNG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcapng', '.ntar'];

export const PCAPNG_ACCEPT_ATTR = '.pcapng,.ntar,application/x-pcapng,application/octet-stream';

export const PCAPNG_FORMATS_LABEL = '.pcapng';

export const PCAPNG_FORMATS_HINT =
  'PCAPNG captures with interface blocks, packets, and statistics. Education/research only.';

export const PCAPNG_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const PCAPNG_MAX_PACKETS = 8000;

export const PCAPNG_RELATED_TOOLS: ReadonlyArray<PcapngRelatedToolLink> = [
  { label: 'PCAP Viewer', description: 'Classic packet timeline', path: '/network-viewers/pcap-viewer' },
  { label: 'Network Traffic Viewer', description: 'Flows and protocols', path: '/network-viewers/network-traffic-viewer' },
  { label: 'Packet Analyzer', description: 'Deep packet inspection', path: '/network-viewers/packet-analyzer' }
];
