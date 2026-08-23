import type { PacketAnalyzerRelatedToolLink } from '../types/packet-analyzer.types';

export const PACKET_ANALYZER_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.pcap',
  '.cap',
  '.pcapng',
  '.hex',
  '.txt',
  '.dump'
];

export const PACKET_ANALYZER_ACCEPT_ATTR =
  '.pcap,.cap,.pcapng,.hex,.txt,.dump,application/vnd.tcpdump.pcap,application/octet-stream,text/plain';

export const PACKET_ANALYZER_FORMATS_LABEL = '.pcap, .pcapng, .hex';

export const PACKET_ANALYZER_FORMATS_HINT =
  'Deep packet inspection with layer decode and hex. Education/research only.';

export const PACKET_ANALYZER_MAX_FILE_BYTES = 30 * 1024 * 1024;

export const PACKET_ANALYZER_RELATED_TOOLS: ReadonlyArray<PacketAnalyzerRelatedToolLink> = [
  { label: 'PCAP Viewer', description: 'Packet timeline and follow-stream', path: '/network-viewers/pcap-viewer' },
  { label: 'Protocol Analyzer', description: 'Protocol-centric dissectors', path: '/network-viewers/protocol-analyzer' },
  { label: 'HTTP Trace Viewer', description: 'HTTP conversation review', path: '/network-viewers/http-trace-viewer' }
];
