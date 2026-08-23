import type { ProtocolAnalyzerRelatedToolLink } from '../types/protocol-analyzer.types';

export const PROTOCOL_ANALYZER_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.pcap', '.cap', '.pcapng', '.json'];

export const PROTOCOL_ANALYZER_ACCEPT_ATTR =
  '.pcap,.cap,.pcapng,.json,application/json,application/vnd.tcpdump.pcap,application/octet-stream';

export const PROTOCOL_ANALYZER_FORMATS_LABEL = '.pcap, .pcapng, .json';

export const PROTOCOL_ANALYZER_FORMATS_HINT =
  'Protocol-centric analysis with dissectors, mix, and timeline. Education/research only.';

export const PROTOCOL_ANALYZER_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const PROTOCOL_ANALYZER_RELATED_TOOLS: ReadonlyArray<ProtocolAnalyzerRelatedToolLink> = [
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' },
  { label: 'PCAP Viewer', description: 'Packet list and follow-stream', path: '/network-viewers/pcap-viewer' },
  { label: 'Network Traffic Viewer', description: 'Flows and talkers', path: '/network-viewers/network-traffic-viewer' },
  { label: 'HTTP Trace Viewer', description: 'HTTP conversation review', path: '/network-viewers/http-trace-viewer' }
];
