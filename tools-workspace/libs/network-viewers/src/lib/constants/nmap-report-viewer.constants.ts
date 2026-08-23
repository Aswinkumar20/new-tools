import type { NmapRelatedToolLink } from '../types/nmap-report-viewer.types';

export const NMAP_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xml', '.gnmap', '.nmap', '.json', '.csv'];

export const NMAP_ACCEPT_ATTR = '.xml,.gnmap,.nmap,.json,.csv,text/xml,application/xml,application/json,text/csv,text/plain';

export const NMAP_FORMATS_LABEL = '.xml, .gnmap, .json';

export const NMAP_FORMATS_HINT =
  'Nmap host and port report browsing from XML, gnmap, or JSON. Education/research only.';

export const NMAP_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const NMAP_RELATED_TOOLS: ReadonlyArray<NmapRelatedToolLink> = [
  { label: 'Nessus Report Viewer', description: 'Findings and severity', path: '/network-viewers/nessus-report-viewer' },
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' },
  { label: 'Firewall Log Viewer', description: 'Allow/deny timeline', path: '/network-viewers/firewall-log-viewer' },
  { label: 'DNS Log Viewer', description: 'Query types and timeline', path: '/network-viewers/dns-log-viewer' }
];
