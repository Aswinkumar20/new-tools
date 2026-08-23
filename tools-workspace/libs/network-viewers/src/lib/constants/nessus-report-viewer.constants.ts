import type { NessusRelatedToolLink } from '../types/nessus-report-viewer.types';

export const NESSUS_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.nessus', '.xml', '.json', '.csv'];

export const NESSUS_ACCEPT_ATTR = '.nessus,.xml,.json,.csv,text/xml,application/xml,application/json,text/csv,text/plain';

export const NESSUS_FORMATS_LABEL = '.nessus, .xml, .json, .csv';

export const NESSUS_FORMATS_HINT =
  'Nessus finding review by host and severity. Education/research only.';

export const NESSUS_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const NESSUS_RELATED_TOOLS: ReadonlyArray<NessusRelatedToolLink> = [
  { label: 'Nmap Report Viewer', description: 'Hosts and open ports', path: '/network-viewers/nmap-report-viewer' },
  { label: 'SIEM Log Viewer', description: 'Correlate security events', path: '/network-viewers/siem-log-viewer' },
  { label: 'SARIF Report Viewer', description: 'Static analysis results', path: '/network-viewers/sarif-report-viewer' },
  { label: 'Malware Analysis Report Viewer', description: 'IOC and behavior', path: '/network-viewers/malware-analysis-report-viewer' }
];
