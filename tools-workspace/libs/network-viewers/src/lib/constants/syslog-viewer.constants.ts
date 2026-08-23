import type { SyslogRelatedToolLink } from '../types/syslog-viewer.types';

export const SYSLOG_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.log', '.txt', '.csv', '.json'];

export const SYSLOG_ACCEPT_ATTR = '.log,.txt,.csv,.json,text/plain,text/csv,application/json';

export const SYSLOG_FORMATS_LABEL = '.log, .csv, .json';

export const SYSLOG_FORMATS_HINT =
  'Syslog browsing by facility and severity (RFC 3164 / 5424). Education/research only.';

export const SYSLOG_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SYSLOG_RELATED_TOOLS: ReadonlyArray<SyslogRelatedToolLink> = [
  { label: 'DNS Log Viewer', description: 'Query types and timeline', path: '/network-viewers/dns-log-viewer' },
  { label: 'Firewall Log Viewer', description: 'Allow/deny timeline', path: '/network-viewers/firewall-log-viewer' },
  { label: 'SIEM Log Viewer', description: 'Correlate security events', path: '/network-viewers/siem-log-viewer' },
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' }
];
