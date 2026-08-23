import type { SiemRelatedToolLink } from '../types/siem-log-viewer.types';

export const SIEM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.csv', '.log', '.txt', '.cef'];

export const SIEM_ACCEPT_ATTR = '.json,.csv,.log,.txt,.cef,application/json,text/csv,text/plain';

export const SIEM_FORMATS_LABEL = '.json, .csv, .cef, .log';

export const SIEM_FORMATS_HINT =
  'Security event browsing with correlation, severity, and search. Education/research only.';

export const SIEM_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const SIEM_RELATED_TOOLS: ReadonlyArray<SiemRelatedToolLink> = [
  { label: 'Firewall Log Viewer', description: 'Allow/deny timeline', path: '/network-viewers/firewall-log-viewer' },
  { label: 'Syslog Viewer', description: 'Facility and severity browse', path: '/network-viewers/syslog-viewer' },
  { label: 'Threat Intelligence Viewer', description: 'Indicators and relationships', path: '/network-viewers/threat-intelligence-viewer' },
  { label: 'Malware Analysis Report Viewer', description: 'IOC and behavior', path: '/network-viewers/malware-analysis-report-viewer' }
];
