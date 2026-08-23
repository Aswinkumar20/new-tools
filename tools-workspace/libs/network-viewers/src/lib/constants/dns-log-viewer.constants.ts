import type { DnsLogRelatedToolLink } from '../types/dns-log-viewer.types';

export const DNS_LOG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.log', '.txt', '.csv', '.json'];

export const DNS_LOG_ACCEPT_ATTR = '.log,.txt,.csv,.json,text/plain,text/csv,application/json';

export const DNS_LOG_FORMATS_LABEL = '.log, .csv, .json';

export const DNS_LOG_FORMATS_HINT =
  'DNS query/response review with types and timeline. Education/research only.';

export const DNS_LOG_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DNS_LOG_RELATED_TOOLS: ReadonlyArray<DnsLogRelatedToolLink> = [
  { label: 'Syslog Viewer', description: 'Facility and severity browse', path: '/network-viewers/syslog-viewer' },
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' },
  { label: 'Protocol Analyzer', description: 'Protocol mix and timeline', path: '/network-viewers/protocol-analyzer' },
  { label: 'Network Traffic Viewer', description: 'Flows and talkers', path: '/network-viewers/network-traffic-viewer' }
];
