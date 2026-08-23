import type { TrafficRelatedToolLink } from '../types/network-traffic-viewer.types';

export const TRAFFIC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcap', '.cap', '.pcapng', '.json', '.csv', '.flow'];

export const TRAFFIC_ACCEPT_ATTR =
  '.pcap,.cap,.pcapng,.json,.csv,.flow,application/json,text/csv,application/vnd.tcpdump.pcap';

export const TRAFFIC_FORMATS_LABEL = '.pcap, .pcapng, .json, .csv, .flow';

export const TRAFFIC_FORMATS_HINT =
  'High-level traffic exploration from captures or flow dumps: conversations, protocols, and talkers. Education/research only.';

export const TRAFFIC_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const TRAFFIC_RELATED_TOOLS: ReadonlyArray<TrafficRelatedToolLink> = [
  { label: 'PCAP Viewer', description: 'Packet timeline and decode', path: '/network-viewers/pcap-viewer' },
  { label: 'PCAPNG Viewer', description: 'Interface-aware captures', path: '/network-viewers/pcapng-viewer' },
  { label: 'HAR Viewer', description: 'Browser waterfall analysis', path: '/network-viewers/har-viewer' },
  { label: 'Protocol Analyzer', description: 'Protocol-centric analysis', path: '/network-viewers/protocol-analyzer' }
];
