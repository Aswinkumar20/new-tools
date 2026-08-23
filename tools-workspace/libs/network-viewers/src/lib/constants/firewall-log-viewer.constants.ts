import type { FirewallRelatedToolLink } from '../types/firewall-log-viewer.types';

export const FIREWALL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.log', '.txt', '.csv', '.json'];

export const FIREWALL_ACCEPT_ATTR = '.log,.txt,.csv,.json,text/plain,text/csv,application/json';

export const FIREWALL_FORMATS_LABEL = '.log, .csv, .json';

export const FIREWALL_FORMATS_HINT =
  'Firewall event exploration: allow/deny, IPs, ports, and rule timeline. Education/research only.';

export const FIREWALL_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const FIREWALL_RELATED_TOOLS: ReadonlyArray<FirewallRelatedToolLink> = [
  { label: 'SIEM Log Viewer', description: 'Correlate security events', path: '/network-viewers/siem-log-viewer' },
  { label: 'Syslog Viewer', description: 'Facility and severity browse', path: '/network-viewers/syslog-viewer' },
  { label: 'Packet Analyzer', description: 'Layer decode and hex', path: '/network-viewers/packet-analyzer' },
  { label: 'Network Traffic Viewer', description: 'Flows and talkers', path: '/network-viewers/network-traffic-viewer' }
];
